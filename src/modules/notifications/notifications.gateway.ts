import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@WebSocketGateway({ cors: true, namespace: '/notifications' })
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

      // Join a unique room for this user to receive private events (like wallet updates)
      await client.join(`user_${payload.sub}`);
      this.logger.log(`User ${payload.sub} connected to notifications socket.`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`User ${client.data?.userId} disconnected from notifications socket.`);
  }

  private extractToken(client: Socket): string | null {
    // 1. Try to get token from handshake auth
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }
    // 2. Try to get token from query params
    if (client.handshake.query?.token) {
      return client.handshake.query.token as string;
    }
    // 3. Try to get token from headers
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }

  /**
   * Emit a real-time event to a specific user's room
   */
  emitToUser(userId: string, event: string, payload: any) {
    this.server.to(`user_${userId}`).emit(event, payload);
  }
}
