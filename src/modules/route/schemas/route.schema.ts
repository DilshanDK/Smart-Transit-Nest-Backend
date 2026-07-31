import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RouteDocument = Route & Document;

@Schema({ _id: false })
export class RouteStop {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  distanceFromStart: number;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  location: {
    type: string;
    coordinates: number[];
  };
}

const RouteStopSchema = SchemaFactory.createForClass(RouteStop);

@Schema({ timestamps: true, collection: 'routes' })
export class Route {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  routeId: string;

  @Prop({ required: true, trim: true })
  routeName: string;

  @Prop({ required: true, trim: true })
  startTerminal: string;

  @Prop({ required: true, trim: true })
  endTerminal: string;

  @Prop({ required: true, min: 0 })
  baseFare: number;

  @Prop({ required: true, min: 0 })
  ratePerKm: number;

  @Prop({ type: [RouteStopSchema], default: [] })
  stops: RouteStop[];

  @Prop({
    type: {
      type: String,
      enum: ['LineString'],
      default: 'LineString',
    },
    coordinates: {
      type: [[Number]],
      default: [],
    },
  })
  path: {
    type: string;
    coordinates: number[][];
  };
}

export const RouteSchema = SchemaFactory.createForClass(Route);
RouteSchema.index({ 'stops.location': '2dsphere' });
