import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Journey, JourneyDocument } from './schemas/journey.schema';
import { Passenger, PassengerDocument } from '../auth/schemas/passenger.schema';
import { Driver, DriverDocument } from '../auth/schemas/driver.schema';
import { WalletLedgerService } from '../payment/services/wallet-ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TapDto } from './dto/tap.dto';

@Injectable()
export class JourneyService {
  constructor(
    @InjectModel(Journey.name)
    private readonly journeyModel: Model<JourneyDocument>,
    @InjectModel(Passenger.name)
    private readonly passengerModel: Model<PassengerDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly walletLedgerService: WalletLedgerService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Generates a QR JWT token for the passenger (expires in 30 seconds)
   */
  async generateQrToken(passengerId: string): Promise<string> {
    const payload = { sub: passengerId };
    const secret = this.configService.get<string>('QR_JWT_SECRET');
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '30s',
    });
  }

  /**
   * Processes a ticket tap (NFC or QR) on the bus
   */
  async processTap(tapDto: TapDto, driverId: string): Promise<any> {
    // 1. Verify driver is on shift
    const driver = await this.driverModel.findById(driverId);
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }
    if (!driver.isOnShift) {
      throw new ForbiddenException(
        'Driver is not currently on an active shift',
      );
    }

    // 2. Extract passenger ID based on mode
    let passengerId: string;
    if (tapDto.mode === 'QR') {
      try {
        const secret = this.configService.get<string>('QR_JWT_SECRET');
        const payload = await this.jwtService.verifyAsync(tapDto.token, {
          secret,
        });
        passengerId = payload.sub;
      } catch {
        throw new BadRequestException('Invalid or expired QR ticket');
      }
    } else {
      // NFC Mode
      const passenger = await this.passengerModel.findOne({
        nfcUid: tapDto.token,
      });
      if (!passenger) {
        throw new NotFoundException(
          'NFC card is not registered to any passenger',
        );
      }
      passengerId = (passenger as any)._id.toString();
    }

    // 3. Check for active IN_PROGRESS journey
    const activeJourney = await this.journeyModel.findOne({
      passengerId: new Types.ObjectId(passengerId),
      status: 'IN_PROGRESS',
    });

    if (!activeJourney) {
      // --- TAP ON ---
      const useMock = this.configService.get<string>('USE_MOCK_LOCATION') === 'true';
      const startLng = useMock ? 79.8612 : tapDto.longitude;
      const startLat = useMock ? 6.9271 : tapDto.latitude;

      const journey = new this.journeyModel({
        passengerId: new Types.ObjectId(passengerId),
        driverId: new Types.ObjectId(driverId),
        routeId: driver.currentBusRegistration
          ? `Bus ${driver.currentBusRegistration}`
          : 'Route 120',
        startLocation: {
          type: 'Point',
          coordinates: [startLng, startLat],
        },
        startTimestamp: new Date(),
        status: 'IN_PROGRESS',
      });
      await journey.save();

      const notification = await this.notificationsService.notifyPassenger(
        passengerId,
        {
          title: 'Journey started',
          body: `Boarded ${journey.routeId}`,
          data: {
            event: 'TAP_ON',
            journeyId: journey._id.toString(),
            routeId: journey.routeId ?? '',
          },
        },
      );

      return {
        event: 'TAP_ON',
        message: 'Tap On Successful',
        notification,
        journey: {
          id: journey._id,
          startTimestamp: journey.startTimestamp,
          routeId: journey.routeId,
        },
      };
    } else {
      // --- TAP OFF ---
      const useMock = this.configService.get<string>('USE_MOCK_LOCATION') === 'true';
      const endLng = useMock ? 79.8720 : tapDto.longitude;
      const endLat = useMock ? 6.9350 : tapDto.latitude;

      const [startLng, startLat] = activeJourney.startLocation.coordinates;
      const distanceKm = this.calculateHaversineDistance(
        startLat,
        startLng,
        endLat,
        endLng,
      );

      // Calculate fare: base of 50.00 LKR + 10.00 LKR per km
      const fare = 50.0 + distanceKm * 10.0;

      const session = await this.journeyModel.db.startSession();
      session.startTransaction();

      try {
        // Deduct fare atomically from passenger wallet
        const tx = await this.walletLedgerService.deductFare(
          passengerId,
          fare,
          driver.companyId,
          (activeJourney as any)._id,
          session,
        );

        activeJourney.endLocation = {
          type: 'Point',
          coordinates: [endLng, endLat],
        };
        activeJourney.endTimestamp = new Date();
        activeJourney.distanceKm = parseFloat(distanceKm.toFixed(2));
        activeJourney.fareCalculated = Types.Decimal128.fromString(
          fare.toFixed(2),
        );
        activeJourney.status = 'COMPLETED';
        activeJourney.paymentTransactionId = tx._id;
        activeJourney.calculationMethod = 'ELAPSED_TIME_FALLBACK';

        await activeJourney.save({ session });
        await session.commitTransaction();

        const notification = await this.notificationsService.notifyPassenger(
          passengerId,
          {
            title: 'Journey completed',
            body: `Fare LKR ${fare.toFixed(2)} for ${distanceKm.toFixed(2)} km`,
            data: {
              event: 'TAP_OFF',
              journeyId: activeJourney._id.toString(),
              fare: fare.toFixed(2),
              distanceKm: distanceKm.toFixed(2),
            },
          },
        );

        return {
          event: 'TAP_OFF',
          message: 'Tap Off Successful',
          fare,
          notification,
          journey: {
            id: activeJourney._id,
            distanceKm: activeJourney.distanceKm,
            fareCalculated: fare,
            startTimestamp: activeJourney.startTimestamp,
            endTimestamp: activeJourney.endTimestamp,
          },
        };
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        await session.endSession();
      }
    }
  }

  /**
   * Fetches active journey for the passenger
   */
  async getActiveJourney(passengerId: string): Promise<any> {
    return this.journeyModel.findOne({
      passengerId: new Types.ObjectId(passengerId),
      status: 'IN_PROGRESS',
    });
  }

  /**
   * Fetches full journey history for the passenger
   */
  async getPassengerHistory(passengerId: string): Promise<any> {
    return this.journeyModel
      .find({ passengerId: new Types.ObjectId(passengerId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Helper: Calculates distance using Haversine formula
   */
  private calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
