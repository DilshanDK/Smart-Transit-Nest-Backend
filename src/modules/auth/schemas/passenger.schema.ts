import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { generateShortId } from '../../../core/utils/id-generator';

export type PassengerDocument = Passenger & Document;

@Schema({ timestamps: true, collection: 'passengers' })
export class Passenger {
  @Prop({ 
    required: true, 
    unique: true, 
    uppercase: true, 
    trim: true, 
    default: () => `PA-${generateShortId(6)}`
  })
  passengerId: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, sparse: true, unique: true })
  nfcUid?: string;

  @Prop({ type: Types.Decimal128, default: 0 })
  walletBalance: Types.Decimal128;

  @Prop({ default: null })
  stripeCustomerId: string;

  @Prop({ default: null })
  googleId: string;

  @Prop({ default: null })
  appleId: string;

  @Prop({ default: null })
  refreshTokenHash: string;

  @Prop({ default: null })
  fcmToken: string;
}

export const PassengerSchema = SchemaFactory.createForClass(Passenger);
