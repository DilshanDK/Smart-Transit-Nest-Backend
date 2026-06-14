import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { generateShortId } from '../../../core/utils/id-generator';

export type BusCompanyDocument = BusCompany & Document;

@Schema({ timestamps: true, collection: 'bus_companies' })
export class BusCompany {
  @Prop({ 
    required: true, 
    unique: true, 
    uppercase: true, 
    trim: true, 
    default: () => `CO-${generateShortId(6)}`
  })
  companyId: string;

  @Prop({ required: true, trim: true })
  companyName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ default: null })
  stripeConnectAccountId: string;

  @Prop({ type: Types.Decimal128, default: 0 })
  pendingLedgerBalance: Types.Decimal128;

  @Prop({ default: false })
  isOnboarded: boolean;
}

export const BusCompanySchema = SchemaFactory.createForClass(BusCompany);
