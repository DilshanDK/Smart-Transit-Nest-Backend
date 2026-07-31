import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { Passenger, PassengerSchema } from '../auth/schemas/passenger.schema';
import { Driver, DriverSchema } from '../auth/schemas/driver.schema';

@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: Passenger.name, schema: PassengerSchema },
      { name: Driver.name, schema: DriverSchema },
    ]),
  ],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
