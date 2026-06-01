import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { Driver, DriverDocument } from '../auth/schemas/driver.schema';
import { TrackingService } from './tracking.service';

interface DriverLocationPayload {
  routeId?: string;
  busNumber?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  status?: string;
  etaToNextStop?: number | null;
}

@WebSocketGateway({ cors: true, namespace: '/tracking' })
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(
    private readonly trackingService: TrackingService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
  ) {}

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        role: string;
      }>(token, { secret });

      client.data.userId = payload.sub;
      client.data.role = payload.role;

      if (payload.role === 'driver') {
        const driver = await this.driverModel.findById(payload.sub);
        if (!driver || !driver.isOnShift) {
          client.disconnect();
          return;
        }
        client.data.busNumber = driver.currentBusRegistration ?? null;
        client.data.routeId = driver.currentBusRegistration ?? null;
      }
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data?.role === 'driver' && client.data?.userId) {
      await this.trackingService.clearDriverLocation(
        client.data.userId as string,
      );
    }
  }

  @SubscribeMessage('join_route')
  async handleJoinRoute(
    @MessageBody() body: { routeId?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const routeId = body?.routeId?.trim();
    if (!routeId) {
      throw new WsException('routeId is required');
    }
    await client.join(`route_${routeId}`);
    return { joined: true, routeId };
  }

  @SubscribeMessage('driver_location')
  async handleDriverLocation(
    @MessageBody() body: DriverLocationPayload,
    @ConnectedSocket() client: Socket,
  ) {
    if (client.data?.role !== 'driver') {
      throw new WsException('Unauthorized');
    }

    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new WsException('Invalid coordinates');
    }

    const routeId = body.routeId?.trim() || client.data?.routeId;
    if (!routeId) {
      throw new WsException('routeId is required');
    }

    const busNumber = body.busNumber?.trim() || client.data?.busNumber || null;

    const payload = {
      driverId: client.data.userId as string,
      routeId,
      busNumber,
      latitude,
      longitude,
      speed: Number(body.speed ?? 0),
      heading: Number(body.heading ?? 0),
      status: body.status ?? 'ACTIVE',
      etaToNextStop: body.etaToNextStop ?? null,
      updatedAt: new Date().toISOString(),
    };

    await this.trackingService.ingestLocation(
      client.data.userId as string,
      payload,
    );
    this.server.to(`route_${routeId}`).emit('bus_moved', payload);

    return { ok: true };
  }

  @SubscribeMessage('request_eta')
  handleRequestEta() {
    return { etaMinutes: null, message: 'ETA calculation not available yet' };
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (authToken) {
      return authToken as string;
    }

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.replace('Bearer ', '').trim();
    }

    return null;
  }
}
