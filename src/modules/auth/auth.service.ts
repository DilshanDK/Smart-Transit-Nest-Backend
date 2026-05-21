import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { Passenger, PassengerDocument } from './schemas/passenger.schema';
import { Driver, DriverDocument } from './schemas/driver.schema';
import { BusCompany, BusCompanyDocument } from './schemas/bus-company.schema';
import { RegisterPassengerDto, LoginPassengerDto, LoginDriverDto, RefreshTokenDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Passenger.name) private passengerModel: Model<PassengerDocument>,
    @InjectModel(Driver.name) private driverModel: Model<DriverDocument>,
    @InjectModel(BusCompany.name) private busCompanyModel: Model<BusCompanyDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────
  // PASSENGER AUTH
  // ──────────────────────────────────────────────

  async registerPassenger(dto: RegisterPassengerDto) {
    // Check if passenger already exists
    const existing = await this.passengerModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new ConflictException('A passenger with this email already exists');
    }

    // Hash password with bcrypt (cost factor 12)
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create the passenger document
    const passenger = await this.passengerModel.create({
      email: dto.email.toLowerCase(),
      fullName: dto.fullName,
      passwordHash,
    });

    // Generate tokens
    const tokens = await this.generateTokens(passenger._id.toString(), 'passenger');

    // Store refresh token hash in DB
    await this.updateRefreshTokenHash(passenger._id.toString(), tokens.refreshToken, 'passenger');

    return {
      message: 'Passenger registered successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: passenger._id,
        email: passenger.email,
        fullName: passenger.fullName,
        walletBalance: 0,
      },
    };
  }

  async loginPassenger(dto: LoginPassengerDto) {
    const passenger = await this.passengerModel.findOne({ email: dto.email.toLowerCase() });
    if (!passenger) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, passenger.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(passenger._id.toString(), 'passenger');
    await this.updateRefreshTokenHash(passenger._id.toString(), tokens.refreshToken, 'passenger');

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: passenger._id,
        email: passenger.email,
        fullName: passenger.fullName,
        walletBalance: parseFloat(passenger.walletBalance?.toString() || '0'),
      },
    };
  }

  // ──────────────────────────────────────────────
  // DRIVER AUTH
  // ──────────────────────────────────────────────

  async verifyDriver(dto: LoginDriverDto) {
    const driver = await this.driverModel.findById(dto.driverId);
    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    // In the future, verify bus registration against company fleet records
    // For now, we set the bus registration and mark the driver as on-shift
    driver.isOnShift = true;
    driver.currentBusRegistration = dto.busRegistration;
    await driver.save();

    const tokens = await this.generateTokens(driver._id.toString(), 'driver');
    await this.updateRefreshTokenHash(driver._id.toString(), tokens.refreshToken, 'driver');

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: driver._id,
        email: driver.email,
        fullName: driver.fullName,
        isOnShift: driver.isOnShift,
        currentBusRegistration: driver.currentBusRegistration,
      },
    };
  }

  // ──────────────────────────────────────────────
  // TOKEN REFRESH (works for all user types)
  // ──────────────────────────────────────────────

  async refreshTokens(userId: string, role: string, dto: RefreshTokenDto) {
    const model = this.getModelByRole(role);
    const user = await model.findById(userId);

    if (!user || !user.refreshTokenHash) {
      throw new ForbiddenException('Access denied');
    }

    const isRefreshTokenValid = await bcrypt.compare(dto.refreshToken, user.refreshTokenHash);
    if (!isRefreshTokenValid) {
      throw new ForbiddenException('Access denied');
    }

    const tokens = await this.generateTokens(userId, role as JwtPayload['role']);
    await this.updateRefreshTokenHash(userId, tokens.refreshToken, role);

    return tokens;
  }

  // ──────────────────────────────────────────────
  // LOGOUT
  // ──────────────────────────────────────────────

  async logout(userId: string, role: string) {
    const model = this.getModelByRole(role);
    await model.findByIdAndUpdate(userId, { refreshTokenHash: null });

    // If the user is a driver, also end their shift
    if (role === 'driver') {
      await this.driverModel.findByIdAndUpdate(userId, {
        isOnShift: false,
        currentBusRegistration: null,
      });
    }

    return { message: 'Logged out successfully' };
  }

  // ──────────────────────────────────────────────
  // GET CURRENT USER PROFILE
  // ──────────────────────────────────────────────

  async getMe(userId: string, role: string) {
    const model = this.getModelByRole(role);
    const user = await model.findById(userId).select('-passwordHash -refreshTokenHash');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { role, user };
  }

  async updateFcmToken(userId: string, role: string, token: string) {
    if (role !== 'passenger' && role !== 'driver') {
      throw new ForbiddenException('Invalid role for FCM token update');
    }

    const model = this.getModelByRole(role);
    await model.findByIdAndUpdate(userId, { fcmToken: token });

    return { message: 'FCM token updated' };
  }

  // ──────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────

  private async generateTokens(userId: string, role: JwtPayload['role']) {
    const payload: JwtPayload = { sub: userId, role };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET')!;
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET')!;
    const accessExpires = this.configService.get<string>('JWT_ACCESS_EXPIRES') || '15m';
    const refreshExpires = this.configService.get<string>('JWT_REFRESH_EXPIRES') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as any, {
        secret: accessSecret,
        expiresIn: accessExpires as any,
      }),
      this.jwtService.signAsync(payload as any, {
        secret: refreshSecret,
        expiresIn: refreshExpires as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshTokenHash(userId: string, refreshToken: string, role: string) {
    const hash = await bcrypt.hash(refreshToken, 12);
    const model = this.getModelByRole(role);
    await model.findByIdAndUpdate(userId, { refreshTokenHash: hash });
  }

  private getModelByRole(role: string): Model<any> {
    switch (role) {
      case 'passenger':
        return this.passengerModel;
      case 'driver':
        return this.driverModel;
      case 'company':
        return this.busCompanyModel;
      default:
        throw new ForbiddenException('Invalid role');
    }
  }
}
