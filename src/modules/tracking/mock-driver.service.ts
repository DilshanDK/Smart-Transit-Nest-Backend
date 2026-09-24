import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrackingService } from './tracking.service';
import { TrackingGateway } from './tracking.gateway';
import { route593Coords } from './data/route-593-coords';

@Injectable()
export class MockDriverService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(MockDriverService.name);
  private timer?: NodeJS.Timeout;
  private currentIndex = 0;
  private coordinates: { lat: number; lng: number }[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly trackingService: TrackingService,
    private readonly trackingGateway: TrackingGateway,
  ) {}

  onApplicationBootstrap() {
    const enableMockTracking = this.configService.get<string>('ENABLE_MOCK_TRACKING');
    const isMockEnabled =
      enableMockTracking !== undefined
        ? enableMockTracking === 'true'
        : this.configService.get<string>('USE_MOCK_LOCATION') === 'true';

    if (!isMockEnabled) {
      this.logger.log(
        'Mock bus driver simulation is DISABLED (set ENABLE_MOCK_TRACKING=true to enable).',
      );
      return;
    }

    this.logger.log(
      '🚍 Starting internal Mock Driver Simulation for Route 593 (Matale to Kandy)...',
    );

    // Reverse coordinates so simulation travels Matale → Kandy
    const reversed = [...route593Coords].reverse();
    this.coordinates = reversed.map(([lng, lat]) => ({ lat, lng }));
    this.currentIndex = 0;

    // Send GPS telemetry every 4 seconds (synchronized with mobile map interpolation)
    this.timer = setInterval(() => {
      this.tick();
    }, 4000);

    // Initial immediate tick
    this.tick();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick() {
    if (!this.coordinates.length) return;

    if (this.currentIndex >= this.coordinates.length) {
      this.logger.log(
        '🔄 Mock bus reached destination. Restarting Route 593 simulation from Matale...',
      );
      this.currentIndex = 0;
    }

    const current = this.coordinates[this.currentIndex];
    const next = this.coordinates[this.currentIndex + 1] || this.coordinates[0];

    const heading = this.getBearing(
      current.lat,
      current.lng,
      next.lat,
      next.lng,
    );
    const speed = 32 + Math.random() * 8; // 32 - 40 km/h realistic driving speed

    const payload = {
      driverId: '6480f8a1e12a459012345679',
      routeId: '593',
      busNumber: 'WP-GA-9021',
      latitude: current.lat,
      longitude: current.lng,
      speed: Number(speed.toFixed(1)),
      heading: Number(heading.toFixed(1)),
      status: 'ACTIVE',
      etaToNextStop: null,
      updatedAt: new Date().toISOString(),
    };

    // 1. Ingest location into MongoDB & in-memory cache
    try {
      await this.trackingService.ingestLocation(payload.driverId, payload);
    } catch (e) {
      this.logger.debug(`Error ingesting mock location: ${e}`);
    }

    // 2. Broadcast location update to WebSocket clients in Route 593 room
    try {
      if (this.trackingGateway.server) {
        this.trackingGateway.server
          .to('route_593')
          .emit('bus_moved', payload);
      }
    } catch (e) {
      this.logger.debug(`Error emitting mock bus_moved: ${e}`);
    }

    this.currentIndex++;
  }

  private getBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  }
}
