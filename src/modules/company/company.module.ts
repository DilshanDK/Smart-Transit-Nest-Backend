import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { Driver, DriverSchema } from '../auth/schemas/driver.schema';
import { Journey, JourneySchema } from '../journey/schemas/journey.schema';
import {
  BusCompany,
  BusCompanySchema,
} from '../auth/schemas/bus-company.schema';
import {
  Transaction,
  TransactionSchema,
} from '../payment/schemas/transaction.schema';
import { PaymentModule } from '../payment/payment.module';
import { PayoutCronService } from './cron/payout.cron';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Driver.name, schema: DriverSchema },
      { name: Journey.name, schema: JourneySchema },
      { name: BusCompany.name, schema: BusCompanySchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    PaymentModule,
  ],
  controllers: [CompanyController],
  providers: [CompanyService, PayoutCronService],
  exports: [CompanyService],
})
export class CompanyModule {}

