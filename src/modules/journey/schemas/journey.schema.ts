import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type JourneyDocument = Journey & Document;

@Schema({ timestamps: true })
export class Journey {
  @Prop({ type: Types.ObjectId, ref: 'Passenger', required: true })
  passengerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Driver', required: true })
  driverId: Types.ObjectId;

  @Prop({ required: true })
  routeId: string;

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
  startLocation: {
    type: string;
    coordinates: number[];
  };

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
    },
    coordinates: {
      type: [Number],
    },
  })
  endLocation?: {
    type: string;
    coordinates: number[];
  };

  @Prop({ required: true, default: Date.now })
  startTimestamp: Date;

  @Prop()
  endTimestamp?: Date;

  @Prop()
  distanceKm?: number;

  @Prop({ type: Types.Decimal128 })
  fareCalculated?: Types.Decimal128;

  @Prop({
    required: true,
    type: String,
    enum: ['IN_PROGRESS', 'COMPLETED', 'FAILED'],
    default: 'IN_PROGRESS',
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  paymentTransactionId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['GOOGLE_MAPS', 'ELAPSED_TIME_FALLBACK'],
    default: 'ELAPSED_TIME_FALLBACK',
  })
  calculationMethod: string;
}

export const JourneySchema = SchemaFactory.createForClass(Journey);

// Add indexes
JourneySchema.index({ passengerId: 1, status: 1 });
JourneySchema.index({ driverId: 1, status: 1 });
JourneySchema.index({ startLocation: '2dsphere' });
JourneySchema.index({ endLocation: '2dsphere' }, { sparse: true });
