import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
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

  // In-memory fallback maps when local Redis is offline
  private readonly fallbackBuses = new Map<
    string,
    { longitude: number; latitude: number }
  >();
  private readonly fallbackBusMeta = new Map<string, string>();

  constructor(
    @InjectModel(LiveTrack.name)
    private readonly liveTrackModel: Model<LiveTrackDocument>,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';

    // Configure Redis client to fail fast and suppress endless logging
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        // Retry connection every 10 seconds silently
        return Math.min(times * 1000, 10000);
      },
    });

    // Handle connection errors silently to avoid crash or spamming standard error
    this.redis.on('error', (err) => {
      this.logger.debug(`Redis offline: ${err.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Successfully connected to Redis tracking server');
    });

    this.flushTimer = setInterval(() => {
      this.flushToMongo().catch((err) => {
        this.logger.error(
          'Failed to flush live bus positions during interval',
          String(err),
        );
      });
    }, 30000);
  }

  async onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        this.redis.disconnect();
      }
    }
  }

  private isRedisConnected(): boolean {
    return this.redis && this.redis.status === 'ready';
  }

  async ingestLocation(driverId: string, payload: LiveBusUpdate) {
    if (this.isRedisConnected()) {
      try {
        await this.redis.geoadd(
          'live_buses',
          payload.longitude,
          payload.latitude,
          driverId,
        );
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
        return;
      } catch (err) {
        this.logger.warn(`Redis write failed, falling back to memory: ${err}`);
      }
    }

    // In-memory fallback
    this.fallbackBuses.set(driverId, {
      longitude: payload.longitude,
      latitude: payload.latitude,
    });
    this.fallbackBusMeta.set(
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
    const promises: Promise<any>[] = [
      this.liveTrackModel.findOneAndUpdate(
        { driverId: new Types.ObjectId(driverId) },
        { $set: { status: 'OFFLINE', lastUpdated: new Date() } },
      ),
    ];

    if (this.isRedisConnected()) {
      promises.push(
        this.redis.zrem('live_buses', driverId).catch(() => {}),
        this.redis.hdel('live_bus_meta', driverId).catch(() => {}),
      );
    } else {
      this.fallbackBuses.delete(driverId);
      this.fallbackBusMeta.delete(driverId);
    }

    await Promise.all(promises);
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
      let driverIds: string[] = [];
      let positions: (string | null)[][] = [];
      let metaPayloads: (string | null)[] = [];

      if (this.isRedisConnected()) {
        try {
          driverIds = await this.redis.hkeys('live_bus_meta');
          if (driverIds.length > 0) {
            const geoposResult = await this.redis.geopos(
              'live_buses',
              ...driverIds,
            );
            positions = geoposResult.map((p) =>
              p ? [p[0], p[1]] : [null, null],
            );
            metaPayloads = await this.redis.hmget(
              'live_bus_meta',
              ...driverIds,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Redis read during flush failed, falling back to memory: ${err}`,
          );
          driverIds = Array.from(this.fallbackBusMeta.keys());
          positions = driverIds.map((d) => {
            const b = this.fallbackBuses.get(d);
            return b
              ? [b.longitude.toString(), b.latitude.toString()]
              : [null, null];
          });
          metaPayloads = driverIds.map(
            (d) => this.fallbackBusMeta.get(d) ?? null,
          );
        }
      } else {
        driverIds = Array.from(this.fallbackBusMeta.keys());
        positions = driverIds.map((d) => {
          const b = this.fallbackBuses.get(d);
          return b
            ? [b.longitude.toString(), b.latitude.toString()]
            : [null, null];
        });
        metaPayloads = driverIds.map(
          (d) => this.fallbackBusMeta.get(d) ?? null,
        );
      }

      if (driverIds.length === 0) {
        return;
      }

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
        const longitude = parseFloat(lngRaw);
        const latitude = parseFloat(latRaw);
        if (Number.isNaN(longitude) || Number.isNaN(latitude)) {
          return ops;
        }

        let meta: any;
        try {
          meta = JSON.parse(metaRaw);
        } catch {
          return ops;
        }

        const updatedAt = meta.updatedAt
          ? new Date(meta.updatedAt)
          : new Date();
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
