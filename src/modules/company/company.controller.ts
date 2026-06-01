import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CompanyService } from './company.service';

@Controller('company')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('stats')
  async getStats(@Req() req: any) {
    const companyId = req.user.userId;
    return this.companyService.getStats(companyId);
  }

  @Get('drivers')
  async getDrivers(@Req() req: any) {
    const companyId = req.user.userId;
    return this.companyService.getDrivers(companyId);
  }

  @Post('drivers')
  async createDriver(
    @Req() req: any,
    @Body()
    dto: {
      fullName: string;
      email: string;
      licenseNumber: string;
      password?: string;
    },
  ) {
    const companyId = req.user.userId;
    return this.companyService.createDriver(companyId, dto);
  }

  @Get('fleet')
  async getFleet(@Req() req: any) {
    const companyId = req.user.userId;
    return this.companyService.getFleet(companyId);
  }

  @Get('reports/by-route')
  async getRevenueByRoute(@Req() req: any) {
    const companyId = req.user.userId;
    return this.companyService.getRevenueByRoute(companyId);
  }
}
