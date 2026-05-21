import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import Redis from 'ioredis';
import { LiveTrack, LiveTrackDocument } from './schemas/live-track.schema';

interface LiveBusUpdate {
  routeId: string;
  busNumber: string | null;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  status: string;
  etaToNextStop: number | null;
}

@Injectable()
export class TrackingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrackingService.name);
  private redis!: Redis;
  private flushTimer?: NodeJS.Timeout;
  private isFlushing = false;

  constructor(
    @InjectModel(LiveTrack.name) private readonly liveTrackModel: Model<LiveTrackDocument>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
    this.flushTimer = setInterval(() => this.flushToMongo(), 30000);
  }

  async onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async ingestLocation(driverId: string, payload: LiveBusUpdate) {
    await this.redis.geoadd('live_buses', payload.longitude, payload.latitude, driverId);
    await this.redis.hset(
      'live_bus_meta',
      driverId,
      JSON.stringify({
        routeId: payload.routeId,
        busNumber: payload.busNumber,
        speed: payload.speed,
        heading: payload.heading,
        status: payload.status,
        etaToNextStop: payload.etaToNextStop,
        updatedAt: Date.now(),
      }),
    );
  }

  async clearDriverLocation(driverId: string) {
    await Promise.all([
      this.redis.zrem('live_buses', driverId),
      this.redis.hdel('live_bus_meta', driverId),
      this.liveTrackModel.findOneAndUpdate(
        { driverId: new Types.ObjectId(driverId) },
        { $set: { status: 'OFFLINE', lastUpdated: new Date() } },
      ),
    ]);
  }

  async getLiveByRoute(routeId: string) {
    return this.liveTrackModel
      .find({ routeId })
      .sort({ lastUpdated: -1 })
      .exec();
  }

  private async flushToMongo() {
    if (this.isFlushing) {
      return;
    }
    this.isFlushing = true;

    try {
      const driverIds = await this.redis.hkeys('live_bus_meta');
      if (driverIds.length === 0) {
        return;
      }

      const positions = await this.redis.geopos('live_buses', ...driverIds);
      const metaPayloads = await this.redis.hmget('live_bus_meta', ...driverIds);

      const bulkOps = driverIds.reduce((ops, driverId, index) => {
        const position = positions[index];
        const metaRaw = metaPayloads[index];
        if (!position || !metaRaw) {
          return ops;
        }

        const [lngRaw, latRaw] = position;
        if (lngRaw == null || latRaw == null) {
          return ops;
        }
        const longitude = parseFloat(lngRaw as unknown as string);
        const latitude = parseFloat(latRaw as unknown as string);
        if (Number.isNaN(longitude) || Number.isNaN(latitude)) {
          return ops;
        }

        let meta: any;
        try {
          meta = JSON.parse(metaRaw);
        } catch {
          return ops;
        }

        const updatedAt = meta.updatedAt ? new Date(meta.updatedAt) : new Date();
        ops.push({
          updateOne: {
            filter: { driverId: new Types.ObjectId(driverId) },
            update: {
              $set: {
                routeId: meta.routeId,
                busNumber: meta.busNumber ?? null,
                location: { type: 'Point', coordinates: [longitude, latitude] },
                speed: meta.speed ?? 0,
                heading: meta.heading ?? 0,
                status: meta.status ?? 'ACTIVE',
                etaToNextStop: meta.etaToNextStop ?? null,
                lastUpdated: updatedAt,
              },
            },
            upsert: true,
          },
        });
        return ops;
      }, [] as any[]);

      if (bulkOps.length > 0) {
        await this.liveTrackModel.bulkWrite(bulkOps, { ordered: false });
      }
    } catch (error) {
      this.logger.error('Failed to flush live bus positions', String(error));
    } finally {
      this.isFlushing = false;
    }
  }
}
