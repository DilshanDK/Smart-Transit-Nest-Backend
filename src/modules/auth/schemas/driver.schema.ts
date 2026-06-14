import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { generateShortId } from '../../../core/utils/id-generator';

export type DriverDocument = Driver & Document;

@Schema({ timestamps: true, collection: 'drivers' })
export class Driver {
  @Prop({ 
    required: true, 
    unique: true, 
    uppercase: true, 
    trim: true, 
    default: () => `DR-${generateShortId(6)}`
  })
  driverId: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  licenseNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'BusCompany', default: null })
  companyId: Types.ObjectId;

  @Prop({ default: false })
  isOnShift: boolean;

  @Prop({ default: null })
  currentBusRegistration: string;

  @Prop({ default: null })
  refreshTokenHash: string;

  @Prop({ default: null })
  fcmToken: string;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);
