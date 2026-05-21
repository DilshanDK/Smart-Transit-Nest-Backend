import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RegisterPassengerDto,
  LoginPassengerDto,
  LoginDriverDto,
  RefreshTokenDto,
  UpdateFcmTokenDto,
} from './dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ──────────────────────────────────────────────
  // PASSENGER ENDPOINTS
  // ──────────────────────────────────────────────

  @Post('passenger/register')
  async registerPassenger(@Body() dto: RegisterPassengerDto) {
    return this.authService.registerPassenger(dto);
  }

  @Post('passenger/login')
  @HttpCode(HttpStatus.OK)
  async loginPassenger(@Body() dto: LoginPassengerDto) {
    return this.authService.loginPassenger(dto);
  }

  @Post('passenger/refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('passenger')
  async refreshPassenger(
    @CurrentUser('userId') userId: string,
    @Body() dto: RefreshTokenDto,
  ) {
    return this.authService.refreshTokens(userId, 'passenger', dto);
  }

  // ──────────────────────────────────────────────
  // DRIVER ENDPOINTS
  // ──────────────────────────────────────────────

  @Post('driver/verify')
  @HttpCode(HttpStatus.OK)
  async verifyDriver(@Body() dto: LoginDriverDto) {
    return this.authService.verifyDriver(dto);
  }

  @Post('driver/refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  async refreshDriver(
    @CurrentUser('userId') userId: string,
    @Body() dto: RefreshTokenDto,
  ) {
    return this.authService.refreshTokens(userId, 'driver', dto);
  }

  // ──────────────────────────────────────────────
  // SHARED ENDPOINTS
  // ──────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: { userId: string; role: string }) {
    return this.authService.logout(user.userId, user.role);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: { userId: string; role: string }) {
    return this.authService.getMe(user.userId, user.role);
  }

  @Post('fcm-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('passenger', 'driver')
  async updateFcmToken(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: UpdateFcmTokenDto,
  ) {
    return this.authService.updateFcmToken(userId, role, dto.token);
  }
}
