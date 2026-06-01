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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Driver.name, schema: DriverSchema },
      { name: Journey.name, schema: JourneySchema },
      { name: BusCompany.name, schema: BusCompanySchema },
    ]),
  ],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
