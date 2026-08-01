import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Route, RouteDocument } from './schemas/route.schema';

@Injectable()
export class RouteService implements OnModuleInit {
  private readonly logger = new Logger(RouteService.name);

  constructor(
    @InjectModel(Route.name)
    private readonly routeModel: Model<RouteDocument>,
  ) {}

  async onModuleInit() {
    // Seed default routes if collection is empty
    const count = await this.routeModel.countDocuments();
    if (count === 0) {
      this.logger.log('Route registry is empty. Seeding default routes...');
      const defaultRoutes = [
        {
          routeId: '138',
          routeName: 'Maharagama - Pettah',
          startTerminal: 'Maharagama',
          endTerminal: 'Pettah',
          baseFare: 50.0,
          ratePerKm: 10.0,
          stops: [
            { name: 'Maharagama Terminal', distanceFromStart: 0, location: { type: 'Point', coordinates: [79.9238, 6.8488] } },
            { name: 'Nugegoda Junction', distanceFromStart: 4.8, location: { type: 'Point', coordinates: [79.8974, 6.8649] } },
            { name: 'Kirulapone', distanceFromStart: 7.2, location: { type: 'Point', coordinates: [79.8789, 6.8778] } },
            { name: 'Tummulla', distanceFromStart: 9.5, location: { type: 'Point', coordinates: [79.8612, 6.9012] } },
            { name: 'Pettah Central Bus Stand', distanceFromStart: 15.0, location: { type: 'Point', coordinates: [79.8448, 6.9339] } }
          ],
          path: {
            type: 'LineString',
            coordinates: [
              [79.9238, 6.8488],
              [79.8974, 6.8649],
              [79.8789, 6.8778],
              [79.8612, 6.9012],
              [79.8448, 6.9339]
            ]
          }
        },
        {
          routeId: '120',
          routeName: 'Horana - Pettah',
          startTerminal: 'Horana',
          endTerminal: 'Pettah',
          baseFare: 50.0,
          ratePerKm: 10.0,
          stops: [
            { name: 'Horana Terminal', distanceFromStart: 0, location: { type: 'Point', coordinates: [80.0628, 6.7176] } },
            { name: 'Kahathuduwa', distanceFromStart: 12.3, location: { type: 'Point', coordinates: [80.0054, 6.7924] } },
            { name: 'Piliyandala', distanceFromStart: 19.5, location: { type: 'Point', coordinates: [79.9228, 6.8016] } },
            { name: 'Nugegoda', distanceFromStart: 28.1, location: { type: 'Point', coordinates: [79.8974, 6.8649] } },
            { name: 'Pettah Central Bus Stand', distanceFromStart: 38.5, location: { type: 'Point', coordinates: [79.8448, 6.9339] } }
          ],
          path: {
            type: 'LineString',
            coordinates: [
              [80.0628, 6.7176],
              [80.0054, 6.7924],
              [79.9228, 6.8016],
              [79.8974, 6.8649],
              [79.8448, 6.9339]
            ]
          }
        },
        {
          routeId: '177',
          routeName: 'Kaduwela - Kollupitiya',
          startTerminal: 'Kaduwela',
          endTerminal: 'Kollupitiya',
          baseFare: 50.0,
          ratePerKm: 12.0,
          stops: [
            { name: 'Kaduwela Interchange', distanceFromStart: 0, location: { type: 'Point', coordinates: [79.9839, 6.9389] } },
            { name: 'Malabe', distanceFromStart: 6.2, location: { type: 'Point', coordinates: [79.9616, 6.9042] } },
            { name: 'Koswatta', distanceFromStart: 9.8, location: { type: 'Point', coordinates: [79.9439, 6.9089] } },
            { name: 'Battaramulla', distanceFromStart: 11.5, location: { type: 'Point', coordinates: [79.9272, 6.8989] } },
            { name: 'Kollupitiya Junction', distanceFromStart: 19.8, location: { type: 'Point', coordinates: [79.8492, 6.9119] } }
          ],
          path: {
            type: 'LineString',
            coordinates: [
              [79.9839, 6.9389],
              [79.9616, 6.9042],
              [79.9439, 6.9089],
              [79.9272, 6.8989],
              [79.8492, 6.9119]
            ]
          }
        }
      ];

      await this.routeModel.insertMany(defaultRoutes);
      this.logger.log('Default routes successfully seeded.');
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
