import { Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { RouteService } from './route.service';

@Controller('routes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  @Get()
  @Roles('passenger', 'driver', 'company')
  async getAllRoutes() {
    return this.routeService.findAll();
  }

  @Get(':routeId')
  @Roles('passenger', 'driver', 'company')
  async getRouteById(@Param('routeId') routeId: string) {
    return this.routeService.findByRouteId(routeId);
  }

  @Post()
  @Roles('company')
  @HttpCode(HttpStatus.OK)
  async createOrUpdateRoute(@Body() dto: any) {
    return this.routeService.createOrUpdate(dto);
  }

  @Delete(':routeId')
  @Roles('company')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRoute(@Param('routeId') routeId: string) {
    return this.routeService.delete(routeId);
  }
}
