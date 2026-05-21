import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { TrackingService } from './tracking.service';

@Controller('tracking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get('live')
  @Roles('passenger', 'driver', 'company')
  async getLiveBuses(@Query('routeId') routeId: string) {
    if (!routeId) {
      throw new BadRequestException('routeId is required');
    }
    return this.trackingService.getLiveByRoute(routeId);
  }
}
