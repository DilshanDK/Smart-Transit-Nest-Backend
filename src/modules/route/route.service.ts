import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Route, RouteDocument } from './schemas/route.schema';

import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RouteService implements OnModuleInit {
  private readonly logger = new Logger(RouteService.name);

  constructor(
    @InjectModel(Route.name)
    private readonly routeModel: Model<RouteDocument>,
  ) {}

  async onModuleInit() {
    // Seed default route if collection is empty
    const count = await this.routeModel.countDocuments();
    if (count === 0) {
      this.logger.log('Route registry is empty. Seeding Route 593 (Kandy - Matale)...');
      
      let highResPath: [number, number][] = [];
      try {
        const jsonPath = path.join(__dirname, '../../../../scripts/route-593-highres.json');
        if (fs.existsSync(jsonPath)) {
          highResPath = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        }
      } catch (e) {
        this.logger.warn('Could not read route-593-highres.json, using built-in fallback coordinates');
      }
      const defaultRoutes = [
        {
          routeId: '593',
          routeName: 'Kandy - Matale',
          startTerminal: 'Kandy',
          endTerminal: 'Matale',
          baseFare: 50.0,
          ratePerKm: 12.0,
          stops: [
            {
              name: 'Kandy',
              distanceFromStart: 0.0,
              location: { type: 'Point', coordinates: [80.6337, 7.2906] },
            },
            {
              name: 'Katugastota',
              distanceFromStart: 4.0,
              location: { type: 'Point', coordinates: [80.6225, 7.3248] },
            },
            {
              name: 'Akurana',
              distanceFromStart: 10.9,
              location: { type: 'Point', coordinates: [80.6186, 7.3686] },
            },
            {
              name: 'Alawathugoda',
              distanceFromStart: 16.5,
              location: { type: 'Point', coordinates: [80.6033, 7.4111] },
            },
            {
              name: 'Alwala (Elwala)',
              distanceFromStart: 21.7,
              location: { type: 'Point', coordinates: [80.6094, 7.4475] },
            },
            {
              name: 'Matale',
              distanceFromStart: 25.7,
              location: { type: 'Point', coordinates: [80.6234, 7.4675] },
            },
          ],
          path: {
            type: 'LineString',
            coordinates: highResPath.length > 0 ? highResPath : [
              [80.6337, 7.2906],
              [80.6225, 7.3248],
              [80.6186, 7.3686],
              [80.6033, 7.4111],
              [80.6094, 7.4475],
              [80.6234, 7.4675],
            ],
          },
        },
      ];

      await this.routeModel.insertMany(defaultRoutes);
      this.logger.log('Route 593 (Kandy - Matale) successfully seeded.');
    }
  }

  async findAll(): Promise<Route[]> {
    return this.routeModel.find().sort({ routeId: 1 }).exec();
  }

  async findByRouteId(routeId: string): Promise<Route> {
    const route = await this.routeModel.findOne({ routeId: routeId.toUpperCase() }).exec();
    if (!route) {
      throw new NotFoundException(`Route ${routeId} not found`);
    }
    return route;
  }

  async createOrUpdate(dto: any): Promise<Route> {
    const { routeId, ...rest } = dto;
    const formattedRouteId = routeId.toUpperCase().trim();

    return this.routeModel.findOneAndUpdate(
      { routeId: formattedRouteId },
      { $set: { routeId: formattedRouteId, ...rest } },
      { new: true, upsert: true },
    ).exec();
  }

  async delete(routeId: string): Promise<void> {
    const result = await this.routeModel.deleteOne({ routeId: routeId.toUpperCase() }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Route ${routeId} not found`);
    }
  }
}
