import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { JourneyController } from './journey.controller';
import { JourneyService } from './journey.service';
import { Journey, JourneySchema } from './schemas/journey.schema';
import { AuthModule } from '../auth/auth.module';
import { PaymentModule } from '../payment/payment.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Journey.name, schema: JourneySchema }]),
    AuthModule,
    PaymentModule,
    NotificationsModule,
    JwtModule.register({}),
  ],
  controllers: [JourneyController],
  providers: [JourneyService],
  exports: [JourneyService],
})
export class JourneyModule {}
