import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { getFirebaseAdminApp } from '../../core/utils/firebase-admin';

import { Passenger, PassengerDocument } from './schemas/passenger.schema';
import { Driver, DriverDocument } from './schemas/driver.schema';
import { BusCompany, BusCompanyDocument } from './schemas/bus-company.schema';
import {
  RegisterPassengerDto,
  LoginPassengerDto,
  LoginDriverDto,
  RefreshTokenDto,
  RegisterCompanyDto,
  LoginCompanyDto,
} from './dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectModel(Passenger.name)
    private passengerModel: Model<PassengerDocument>,
    @InjectModel(Driver.name) private driverModel: Model<DriverDocument>,
    @InjectModel(BusCompany.name)
    private busCompanyModel: Model<BusCompanyDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    if (process.env.SEED_DEMO_ACCOUNTS === 'true') {
      await this.seedDemoAccounts();
    }
  }

  private async seedDemoAccounts() {
    const passwordHash = await bcrypt.hash('password123', 12);

    // 1. Seed/Reset Passenger
    const passengerEmail = 'passenger@test.com';
    await this.passengerModel.deleteOne({ email: passengerEmail });
    await this.passengerModel.create({
      _id: new Types.ObjectId('6480f8a1e12a459012345677'),
      email: passengerEmail,
      fullName: 'Test Passenger',
      passwordHash,
      walletBalance: 1000.0,
    });
    console.log('Seeded/Reset demo passenger: passenger@test.com / password123 (ID: 6480f8a1e12a459012345677)');

    // 2. Seed/Reset Company
    const companyEmail = 'company@test.com';
    await this.busCompanyModel.deleteOne({ email: companyEmail });
    const company = await this.busCompanyModel.create({
      _id: new Types.ObjectId('6480f8a1e12a459012345678'),
      companyName: 'Express Transit Ltd',
      email: companyEmail,
      passwordHash,
      isOnboarded: true,
    });
    console.log('Seeded/Reset demo company: company@test.com / password123 (ID: 6480f8a1e12a459012345678)');

    // 3. Seed/Reset Driver under Company
    const driverEmail = 'driver@test.com';
    await this.driverModel.deleteOne({ email: driverEmail });
    await this.driverModel.create({
      _id: new Types.ObjectId('6480f8a1e12a459012345679'),
      fullName: 'David Driver',
      email: driverEmail,
      passwordHash,
      companyId: company._id,
      licenseNumber: 'DL-998822A',
      isOnShift: false,
      currentBusRegistration: 'WP-GA-9021',
    });
    console.log('Seeded/Reset demo driver: driver@test.com / password123 (ID: 6480f8a1e12a459012345679)');
  }

  async login(dto: LoginPassengerDto) {
    const email = dto.email.toLowerCase();

    // 1. Try Bus Company first
    const company = await this.busCompanyModel.findOne({ email });
    if (company) {
      const isPasswordValid = await bcrypt.compare(dto.password, company.passwordHash);
      if (isPasswordValid) {
        const tokens = await this.generateTokens(company._id.toString(), 'company');
        await this.updateRefreshTokenHash(company._id.toString(), tokens.refreshToken, 'company');
        return {
          role: 'company',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: company._id,
            companyId: company.companyId,
            email: company.email,
            companyName: company.companyName,
            isOnboarded: company.isOnboarded,
          },
        };
      }
    }

    // 2. Try Passenger next
    const passenger = await this.passengerModel.findOne({ email });
    if (passenger) {
      const isPasswordValid = await bcrypt.compare(dto.password, passenger.passwordHash);
      if (isPasswordValid) {
        const tokens = await this.generateTokens(passenger._id.toString(), 'passenger');
        await this.updateRefreshTokenHash(passenger._id.toString(), tokens.refreshToken, 'passenger');
        return {
          role: 'passenger',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: passenger._id,
            passengerId: passenger.passengerId,
            email: passenger.email,
            fullName: passenger.fullName,
            walletBalance: parseFloat(passenger.walletBalance?.toString() || '0'),
          },
        };
      }
    }

    // 3. Try Driver next
    const driver = await this.driverModel.findOne({ email });
    if (driver) {
      const isPasswordValid = await bcrypt.compare(dto.password, driver.passwordHash);
      if (isPasswordValid) {
        const tokens = await this.generateTokens(driver._id.toString(), 'driver');
        await this.updateRefreshTokenHash(driver._id.toString(), tokens.refreshToken, 'driver');
        return {
          role: 'driver',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: driver._id,
            driverId: driver.driverId,
            email: driver.email,
            fullName: driver.fullName,
            isOnShift: driver.isOnShift,
            currentBusRegistration: driver.currentBusRegistration,
          },
        };
      }
    }

    throw new UnauthorizedException('Invalid email or password');
  }

  // ──────────────────────────────────────────────
  // GOOGLE AUTH
  // ──────────────────────────────────────────────

  private async verifyAnyGoogleIdToken(idToken: string): Promise<{ email: string; name?: string; uid: string }> {
    // 1. Try Firebase Admin SDK verification (for Next.js Web Firebase Popup tokens)
    try {
      const app = getFirebaseAdminApp(this.configService);
      const decoded = await app.auth().verifyIdToken(idToken);
      if (decoded.email) {
        return { email: decoded.email, name: decoded.name, uid: decoded.uid };
      }
    } catch (_) {}

    // 2. Fallback to google-auth-library (for Flutter Native Google Sign-In tokens)
    try {
      const oauthClient = new OAuth2Client();
      const ticket = await oauthClient.verifyIdToken({ idToken });
      const payload = ticket.getPayload();
      if (payload && payload.email) {
        return {
          email: payload.email,
          name: payload.name || payload.given_name || payload.email.split('@')[0],
          uid: payload.sub,
        };
      }
    } catch (_) {}

    throw new UnauthorizedException('Invalid Google token');
  }

  async googleLogin(idToken: string, role: 'passenger' | 'driver' | 'company') {
    const { email, name, uid } = await this.verifyAnyGoogleIdToken(idToken);

    const model = this.getModelByRole(role);
    const existingUser = await model.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      // Link account
      existingUser.googleId = uid;
      await existingUser.save();

      const tokens = await this.generateTokens(existingUser._id.toString(), role);
      await this.updateRefreshTokenHash(existingUser._id.toString(), tokens.refreshToken, role);
      return this.formatLoginResponse(existingUser, tokens, role);
    } else {
      // Security Enforcement: Block un-registered emails from logging in as Driver or Company
      if (role === 'driver') {
        throw new UnauthorizedException(
          'No registered driver account found for this email. Please contact your bus company administrator.',
        );
      }
      if (role === 'company') {
        throw new UnauthorizedException(
          'No registered company account found for this email. Please register your company first.',
        );
      }

      // Create account (Only Passengers are permitted self-registration via Google)
      // Generate a random password since they login with Google
      const passwordHash = await bcrypt.hash(Math.random().toString(36).slice(-10), 12);
      const newUserObj: any = {
        email: email.toLowerCase(),
        passwordHash,
        googleId: uid,
        fullName: name || 'Google Passenger',
      };

      const newUser = await model.create(newUserObj);

      const tokens = await this.generateTokens(newUser._id.toString(), role);
      await this.updateRefreshTokenHash(newUser._id.toString(), tokens.refreshToken, role);
      return this.formatLoginResponse(newUser, tokens, role);
    }
  }

  async googleLoginUnified(idToken: string) {
    const { email, uid } = await this.verifyAnyGoogleIdToken(idToken);
    if (!email) {
      throw new UnauthorizedException('Google account has no email');
    }

    const searchEmail = email.toLowerCase();

    // 1. Check Company
    const companyModel = this.getModelByRole('company');
    const existingCompany = await companyModel.findOne({ email: searchEmail });
    if (existingCompany) {
      existingCompany.googleId = uid;
      await existingCompany.save();
      const tokens = await this.generateTokens(existingCompany._id.toString(), 'company');
      await this.updateRefreshTokenHash(existingCompany._id.toString(), tokens.refreshToken, 'company');
      return this.formatLoginResponse(existingCompany, tokens, 'company');
    }

    // 2. Check Passenger
    const passengerModel = this.getModelByRole('passenger');
    const existingPassenger = await passengerModel.findOne({ email: searchEmail });
    if (existingPassenger) {
      existingPassenger.googleId = uid;
      await existingPassenger.save();
      const tokens = await this.generateTokens(existingPassenger._id.toString(), 'passenger');
      await this.updateRefreshTokenHash(existingPassenger._id.toString(), tokens.refreshToken, 'passenger');
      return this.formatLoginResponse(existingPassenger, tokens, 'passenger');
    }

    // 3. Check Driver
    const driverModel = this.getModelByRole('driver');
    const existingDriver = await driverModel.findOne({ email: searchEmail });
    if (existingDriver) {
      existingDriver.googleId = uid;
      await existingDriver.save();
      const tokens = await this.generateTokens(existingDriver._id.toString(), 'driver');
      await this.updateRefreshTokenHash(existingDriver._id.toString(), tokens.refreshToken, 'driver');
      return this.formatLoginResponse(existingDriver, tokens, 'driver');
    }

    // If not found in any collection, prevent login
    throw new UnauthorizedException('Account not found. Please register first.');
  }

  private formatLoginResponse(user: any, tokens: any, role: string) {
    let userResponse: any = {
      id: user._id,
      email: user.email,
    };

    if (role === 'passenger') {
      userResponse.passengerId = user.passengerId;
      userResponse.fullName = user.fullName;
      userResponse.walletBalance = parseFloat(user.walletBalance?.toString() || '0');
    } else if (role === 'driver') {
      userResponse.driverId = user.driverId;
      userResponse.fullName = user.fullName;
      userResponse.isOnShift = user.isOnShift;
      userResponse.currentBusRegistration = user.currentBusRegistration;
    } else if (role === 'company') {
      userResponse.companyId = user.companyId;
      userResponse.companyName = user.companyName;
      userResponse.isOnboarded = user.isOnboarded;
    }

    return {
      role,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userResponse,
    };
  }

  // ──────────────────────────────────────────────
  // PASSENGER AUTH
  // ──────────────────────────────────────────────

  async registerPassenger(dto: RegisterPassengerDto) {
    // Check if passenger already exists
    const existing = await this.passengerModel.findOne({
      email: dto.email.toLowerCase(),
    });
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
    const tokens = await this.generateTokens(
      passenger._id.toString(),
      'passenger',
    );

    // Store refresh token hash in DB
    await this.updateRefreshTokenHash(
      passenger._id.toString(),
      tokens.refreshToken,
      'passenger',
    );

    return {
      message: 'Passenger registered successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: passenger._id,
        passengerId: passenger.passengerId,
        email: passenger.email,
        fullName: passenger.fullName,
        walletBalance: 0,
      },
    };
  }

  async loginPassenger(dto: LoginPassengerDto) {
    const passenger = await this.passengerModel.findOne({
      email: dto.email.toLowerCase(),
    });
    if (!passenger) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      passenger.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(
      passenger._id.toString(),
      'passenger',
    );
    await this.updateRefreshTokenHash(
      passenger._id.toString(),
      tokens.refreshToken,
      'passenger',
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: passenger._id,
        passengerId: passenger.passengerId,
        email: passenger.email,
        fullName: passenger.fullName,
        walletBalance: parseFloat(passenger.walletBalance?.toString() || '0'),
      },
    };
  }

  async registerCompany(dto: RegisterCompanyDto) {
    const existing = await this.busCompanyModel.findOne({
      email: dto.email.toLowerCase(),
    });
    if (existing) {
      throw new ConflictException(
        'A bus company with this email already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const company = await this.busCompanyModel.create({
      companyName: dto.companyName,
      email: dto.email.toLowerCase(),
      passwordHash,
    });

    const tokens = await this.generateTokens(company._id.toString(), 'company');
    await this.updateRefreshTokenHash(
      company._id.toString(),
      tokens.refreshToken,
      'company',
    );

    return {
      message: 'Bus company registered successfully',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: company._id,
        companyId: company.companyId,
        email: company.email,
        companyName: company.companyName,
        isOnboarded: company.isOnboarded,
      },
    };
  }

  async loginCompany(dto: LoginCompanyDto) {
    const company = await this.busCompanyModel.findOne({
      email: dto.email.toLowerCase(),
    });
    if (!company) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      company.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(company._id.toString(), 'company');
    await this.updateRefreshTokenHash(
      company._id.toString(),
      tokens.refreshToken,
      'company',
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: company._id,
        companyId: company.companyId,
        email: company.email,
        companyName: company.companyName,
        isOnboarded: company.isOnboarded,
      },
    };
  }

  // ──────────────────────────────────────────────
  // DRIVER AUTH
  // ──────────────────────────────────────────────

  async verifyDriver(dto: LoginDriverDto) {
    const input = (dto.loginInput || dto.driverId || '').trim();
    if (!input) {
      throw new UnauthorizedException('Driver ID or Email is required');
    }

    let driver: DriverDocument | null = null;

    if (Types.ObjectId.isValid(input)) {
      driver = await this.driverModel.findById(input);
    }
    if (!driver) {
      driver = await this.driverModel.findOne({
        $or: [
          { driverId: input },
          { email: input.toLowerCase() },
          { licenseNumber: input },
        ],
      });
    }

    if (!driver) {
      throw new NotFoundException('Driver not found. Please verify your Driver ID or Email.');
    }

    // Password Validation
    if (dto.password) {
      const isPasswordValid = await bcrypt.compare(dto.password, driver.passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid Driver ID/Email or Password');
      }
    }

    if (dto.busRegistration) {
      driver.currentBusRegistration = dto.busRegistration;
      await driver.save();
    }

    const tokens = await this.generateTokens(driver._id.toString(), 'driver');
    await this.updateRefreshTokenHash(
      driver._id.toString(),
      tokens.refreshToken,
      'driver',
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: driver._id,
        driverId: driver.driverId,
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

    const isRefreshTokenValid = await bcrypt.compare(
      dto.refreshToken,
      user.refreshTokenHash,
    );
    if (!isRefreshTokenValid) {
      throw new ForbiddenException('Access denied');
    }

    const tokens = await this.generateTokens(
      userId,
      role as JwtPayload['role'],
    );
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
    const user = await model
      .findById(userId)
      .select('-passwordHash -refreshTokenHash');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userObj = user.toObject();

    // Parse Decimal128 to standard float numbers for frontend consumption
    if (role === 'passenger' && userObj.walletBalance) {
      userObj.walletBalance = parseFloat(userObj.walletBalance.toString());
    } else if (role === 'company' && userObj.pendingLedgerBalance) {
      userObj.pendingLedgerBalance = parseFloat(userObj.pendingLedgerBalance.toString());
    }

    return { role, user: userObj };
  }

  async updateFcmToken(userId: string, role: string, token: string) {
    if (role !== 'passenger' && role !== 'driver') {
      throw new ForbiddenException('Invalid role for FCM token update');
    }

    const model = this.getModelByRole(role);
    await model.findByIdAndUpdate(userId, { fcmToken: token });

    return { message: 'FCM token updated' };
  }

  async updateProfile(
    userId: string,
    role: string,
    dto: {
      fullName?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    },
  ) {
    const model = this.getModelByRole(role);
    const user = await model.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updates: any = {};

    if (dto.fullName) {
      updates.fullName = dto.fullName;
    }

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const existing = await model.findOne({ email: dto.email.toLowerCase() });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
      updates.email = dto.email.toLowerCase();
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new ForbiddenException(
          'Current password is required to change password',
        );
      }
      const isMatch = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!isMatch) {
        throw new ForbiddenException('Invalid current password');
      }
      updates.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    }

    const updatedUser = await model
      .findByIdAndUpdate(userId, { $set: updates }, { new: true })
      .select('-passwordHash -refreshTokenHash');

    return { message: 'Profile updated successfully', user: updatedUser };
  }

  // ──────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────

  private async generateTokens(userId: string, role: JwtPayload['role']) {
    const payload: JwtPayload = { sub: userId, role };

    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET')!;
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET')!;
    const accessExpires =
      this.configService.get<string>('JWT_ACCESS_EXPIRES') || '15m';
    const refreshExpires =
      this.configService.get<string>('JWT_REFRESH_EXPIRES') || '7d';

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

  private async updateRefreshTokenHash(
    userId: string,
    refreshToken: string,
    role: string,
  ) {
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
