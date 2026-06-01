import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LiveTrackDocument = LiveTrack & Document;

@Schema({ timestamps: true, collection: 'live_tracks' })
export class LiveTrack {
  @Prop({
    type: Types.ObjectId,
    ref: 'Driver',
    required: true,
    unique: true,
    index: true,
  })
  driverId: Types.ObjectId;

  @Prop({ required: true })
  routeId: string;

  @Prop({ type: String, default: null })
  busNumber: string | null;

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
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop({ default: 0 })
  speed: number;

  @Prop({ default: 0 })
  heading: number;

  @Prop({ default: 'ACTIVE' })
  status: string;

  @Prop({ type: Number, default: null })
  etaToNextStop: number | null;

  @Prop({ default: Date.now })
  lastUpdated: Date;
}

export const LiveTrackSchema = SchemaFactory.createForClass(LiveTrack);
LiveTrackSchema.index({ location: '2dsphere' });
LiveTrackSchema.index({ routeId: 1, lastUpdated: -1 });
