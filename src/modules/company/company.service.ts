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

  async assignDriverRouteAndBus(
    companyId: string,
    driverId: string,
    dto: { assignedRouteId: string; currentBusRegistration: string },
  ) {
    const driver = await this.driverModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(driverId),
        companyId: new Types.ObjectId(companyId),
      },
      {
        $set: {
          assignedRouteId: dto.assignedRouteId,
          currentBusRegistration: dto.currentBusRegistration,
        },
      },
      { new: true },
    );
    if (!driver) {
      throw new NotFoundException('Driver not found under this company');
    }
    return {
      message: 'Driver route and bus assigned successfully',
      driver: {
        id: driver._id,
        fullName: driver.fullName,
        assignedRouteId: driver.assignedRouteId,
        currentBusRegistration: driver.currentBusRegistration,
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
      assignedRouteId: d.assignedRouteId || '593',
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

  async exportJourneysToCsv(companyId: string, from?: string, to?: string): Promise<string> {
    const companyDrivers = await this.driverModel.find({
      companyId: new Types.ObjectId(companyId),
    });
    const driverIds = companyDrivers.map((d) => d._id);
    const driverMap = new Map(companyDrivers.map((d) => [d._id.toString(), d.fullName]));

    const query: any = {
      driverId: { $in: driverIds },
      status: 'COMPLETED',
    };

    if (from || to) {
      query.startTimestamp = {};
      if (from) {
        query.startTimestamp.$gte = new Date(from);
      }
      if (to) {
        query.startTimestamp.$lte = new Date(to);
      }
    }

    const journeys = await this.journeyModel.find(query).sort({ startTimestamp: -1 });

    const headers = ['Journey ID', 'Driver Name', 'Route ID', 'Start Coordinates', 'End Coordinates', 'Start Time', 'End Time', 'Distance (Km)', 'Fare (LKR)'];
    const rows = journeys.map((j) => {
      const driverName = driverMap.get(j.driverId?.toString()) || 'Unknown';
      const startCoords = j.startLocation?.coordinates ? j.startLocation.coordinates.join('; ') : 'N/A';
      const endCoords = j.endLocation?.coordinates ? j.endLocation.coordinates.join('; ') : 'N/A';
      return [
        j._id.toString(),
        `"${driverName.replace(/"/g, '""')}"`,
        j.routeId || 'N/A',
        `"${startCoords}"`,
        `"${endCoords}"`,
        j.startTimestamp ? j.startTimestamp.toISOString() : 'N/A',
        j.endTimestamp ? j.endTimestamp.toISOString() : 'N/A',
        j.distanceKm !== undefined ? j.distanceKm.toString() : 'N/A',
        j.fareCalculated ? j.fareCalculated.toString() : '0',
      ];
    });

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  async getDailyRevenueTrend(companyId: string, from?: string, to?: string) {
    const companyDrivers = await this.driverModel.find({
      companyId: new Types.ObjectId(companyId),
    });
    const driverIds = companyDrivers.map((d) => d._id);

    // Default to last 7 days if from/to not specified
    const endDate = to ? new Date(to) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = from ? new Date(from) : new Date();
    if (!from) {
      startDate.setDate(startDate.getDate() - 6);
    }
    startDate.setHours(0, 0, 0, 0);

    const journeys = await this.journeyModel.find({
      driverId: { $in: driverIds },
      status: 'COMPLETED',
      startTimestamp: { $gte: startDate, $lte: endDate },
    });

    // Generate date map for all days in range (limit to 31 days max to prevent large arrays)
    const dayMap = new Map<string, number>();
    const curr = new Date(startDate);
    let count = 0;
    while (curr <= endDate && count < 31) {
      const key = curr.toISOString().slice(0, 10);
      dayMap.set(key, 0);
      curr.setDate(curr.getDate() + 1);
      count++;
    }

    journeys.forEach((j) => {
      if (j.startTimestamp) {
        const key = j.startTimestamp.toISOString().slice(0, 10);
        const fare = j.fareCalculated
          ? parseFloat(j.fareCalculated.toString())
          : 0;
        if (dayMap.has(key)) {
          dayMap.set(key, (dayMap.get(key) || 0) + fare);
        }
      }
    });

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return Array.from(dayMap.entries()).map(([dateStr, revenue]) => {
      const d = new Date(dateStr);
      const label = `${monthNames[d.getMonth()]} ${d.getDate()}`;
      return {
        date: dateStr,
        day: label,
        revenue: Math.round(revenue * 100) / 100,
      };
    });
  }
}
