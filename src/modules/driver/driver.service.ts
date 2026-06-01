import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Driver, DriverDocument } from '../auth/schemas/driver.schema';

@Injectable()
export class DriverService {
  constructor(
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
  ) {}

  async startShift(driverId: string): Promise<Driver> {
    const driver = await this.driverModel.findByIdAndUpdate(
      driverId,
      { isOnShift: true },
      { new: true },
    );
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    return driver;
  }

  async endShift(driverId: string): Promise<Driver> {
    const driver = await this.driverModel.findByIdAndUpdate(
      driverId,
      { isOnShift: false },
      { new: true },
    );
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    return driver;
  }
}
