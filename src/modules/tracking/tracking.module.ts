import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { LiveTrack, LiveTrackSchema } from './schemas/live-track.schema';
import { TrackingService } from './tracking.service';
import { TrackingGateway } from './tracking.gateway';
import { TrackingController } from './tracking.controller';
import { Driver, DriverSchema } from '../auth/schemas/driver.schema';

@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: LiveTrack.name, schema: LiveTrackSchema },
      { name: Driver.name, schema: DriverSchema },
    ]),
  ],
  providers: [TrackingService, TrackingGateway],
  controllers: [TrackingController],
})
export class TrackingModule {}
