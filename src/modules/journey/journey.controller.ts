import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { JourneyService } from './journey.service';
import { TapDto } from './dto/tap.dto';

@Controller('journey')
export class JourneyController {
  constructor(private readonly journeyService: JourneyService) {}

  @Post('tap')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('driver')
  async processTap(@Body() dto: TapDto, @Req() req: any) {
    const driverId = req.user.userId;
    return this.journeyService.processTap(dto, driverId);
  }

  @Get('qr-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('passenger')
  async getQrToken(@Req() req: any) {
    const passengerId = req.user.userId;
    const token = await this.journeyService.generateQrToken(passengerId);
    return { token };
  }

  @Get('active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('passenger')
  async getActiveJourney(@Req() req: any) {
    const passengerId = req.user.userId;
    return this.journeyService.getActiveJourney(passengerId);
  }

  @Get('passenger/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('passenger')
  async getPassengerHistory(@Req() req: any) {
    const passengerId = req.user.userId;
    return this.journeyService.getPassengerHistory(passengerId);
  }
}
