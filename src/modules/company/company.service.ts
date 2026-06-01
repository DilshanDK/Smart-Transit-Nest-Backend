import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Driver, DriverDocument } from '../auth/schemas/driver.schema';
import { Journey, JourneyDocument } from '../journey/schemas/journey.schema';
import {
  BusCompany,
  BusCompanyDocument,
} from '../auth/schemas/bus-company.schema';

@Injectable()
export class CompanyService {
  constructor(
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Journey.name)
    private readonly journeyModel: Model<JourneyDocument>,
    @InjectModel(BusCompany.name)
    private readonly busCompanyModel: Model<BusCompanyDocument>,
  ) {}

  async getStats(companyId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const companyObjectId = new Types.ObjectId(companyId);

    // 1. Get drivers list to match journeys
    const companyDrivers = await this.driverModel.find({
      companyId: companyObjectId,
    });
    const driverIds = companyDrivers.map((d) => d._id);

    // 2. Fetch company info
    const company = await this.busCompanyModel.findById(companyId);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // 3. Count active drivers (isOnShift = true)
    const activeDriversCount = companyDrivers.filter((d) => d.isOnShift).length;

    // 4. Count active buses (unique registrations from active drivers)
    const activeBuses = new Set(
      companyDrivers
        .filter((d) => d.isOnShift && d.currentBusRegistration)
        .map((d) => d.currentBusRegistration),
    );
    const activeBusesCount = activeBuses.size;

    // 5. Query today's journeys for this company's drivers
    const todayJourneys = await this.journeyModel.find({
      driverId: { $in: driverIds },
      startTimestamp: { $gte: todayStart, $lte: todayEnd },
    });

    const completedJourneys = todayJourneys.filter(
      (j) => j.status === 'COMPLETED',
    );
    const journeysCount = todayJourneys.length;

    // 6. Calculate total daily revenue
    let dailyRevenue = 0;
    completedJourneys.forEach((j) => {
      const fare = j.fareCalculated
        ? parseFloat(j.fareCalculated.toString())
        : 0;
      dailyRevenue += fare;
    });

    return {
      dailyRevenue,
      activeDrivers: activeDriversCount,
      activeBuses: activeBusesCount,
      totalJourneys: journeysCount,
      pendingLedgerBalance: company.pendingLedgerBalance
        ? parseFloat(company.pendingLedgerBalance.toString())
        : 0,
      isOnboarded: company.isOnboarded,
    };
  }

  async getDrivers(companyId: string) {
    return this.driverModel
      .find({ companyId: new Types.ObjectId(companyId) })
      .select('-passwordHash -refreshTokenHash')
      .exec();
  }

  async createDriver(
    companyId: string,
    dto: {
      fullName: string;
      email: string;
      licenseNumber: string;
      password?: string;
    },
  ) {
    const existing = await this.driverModel.findOne({
      email: dto.email.toLowerCase(),
    });
    if (existing) {
      throw new ConflictException('A driver with this email already exists');
    }

    const defaultPassword = dto.password || 'driver123';
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    const driver = await this.driverModel.create({
      fullName: dto.fullName,
      email: dto.email.toLowerCase(),
      licenseNumber: dto.licenseNumber,
      companyId: new Types.ObjectId(companyId),
      passwordHash,
      isOnShift: false,
    });

    return {
      message: 'Driver registered successfully',
      driver: {
        id: driver._id,
        fullName: driver.fullName,
        email: driver.email,
        licenseNumber: driver.licenseNumber,
      },
    };
  }

  async getFleet(companyId: string) {
    // Get all drivers of this company who are currently on shift
    const activeDrivers = await this.driverModel.find({
      companyId: new Types.ObjectId(companyId),
      isOnShift: true,
    });

    // Return the list of bus registrations and matching driver details
    return activeDrivers.map((d) => ({
      busRegistration: d.currentBusRegistration,
      driverName: d.fullName,
      driverId: d._id,
      lastActive: (d as any).updatedAt || new Date(),
    }));
  }

  async getRevenueByRoute(companyId: string) {
    const companyDrivers = await this.driverModel.find({
      companyId: new Types.ObjectId(companyId),
    });
    const driverIds = companyDrivers.map((d) => d._id);

    // Aggregate completed journeys by routeId
    const journeys = await this.journeyModel.find({
      driverId: { $in: driverIds },
      status: 'COMPLETED',
    });

    const routeStats: {
      [routeId: string]: { routeId: string; revenue: number; trips: number };
    } = {};

    journeys.forEach((j) => {
      const route = j.routeId || 'Unknown';
      const fare = j.fareCalculated
        ? parseFloat(j.fareCalculated.toString())
        : 0;
      if (!routeStats[route]) {
        routeStats[route] = { routeId: route, revenue: 0, trips: 0 };
      }
      routeStats[route].revenue += fare;
      routeStats[route].trips += 1;
    });

    return Object.values(routeStats);
  }
}
