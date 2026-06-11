import { Controller, Get, Post, Body, Req, UseGuards, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { CompanyService } from './company.service';
import { PayoutCronService } from './cron/payout.cron';

@Controller('company')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('company')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
    private readonly payoutCronService: PayoutCronService,
  ) {}

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

  @Get('reports/export')
  async exportReports(
    @Req() req: any,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: any,
  ) {
    const companyId = req.user.userId;
    const csv = await this.companyService.exportJourneysToCsv(companyId, from, to);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=company_revenue_report_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    return res.status(200).send(csv);
  }

  @Post('payout/trigger')
  async triggerPayout() {
    await this.payoutCronService.handleNightlyPayout();
    return { message: 'Nightly payout process triggered successfully' };
  }
}


