import { Controller, Post, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { DriverService } from './driver.service';

@Controller('driver')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('driver')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Post('shift/start')
  async startShift(@Req() req: any) {
    const driverId = req.user.userId;
    const driver = await this.driverService.startShift(driverId);
    return {
      message: 'Shift started successfully',
      user: {
        id: (driver as any)._id,
        email: driver.email,
        fullName: driver.fullName,
        isOnShift: driver.isOnShift,
        currentBusRegistration: driver.currentBusRegistration,
      },
    };
  }

  @Post('shift/end')
  async endShift(@Req() req: any) {
    const driverId = req.user.userId;
    const driver = await this.driverService.endShift(driverId);
    return {
      message: 'Shift ended successfully',
      user: {
        id: (driver as any)._id,
        email: driver.email,
        fullName: driver.fullName,
        isOnShift: driver.isOnShift,
        currentBusRegistration: driver.currentBusRegistration,
      },
    };
  }
}
