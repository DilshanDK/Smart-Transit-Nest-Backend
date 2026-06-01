import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TransactionDocument = Transaction & Document;

export enum TransactionType {
  WALLET_TOPUP = 'WALLET_TOPUP',
  JOURNEY_DEDUCTION = 'JOURNEY_DEDUCTION',
}

@Schema({ timestamps: true, collection: 'transactions' })
export class Transaction {
  @Prop({ type: String, enum: TransactionType, required: true })
  type: TransactionType;

  @Prop({ type: Types.Decimal128, required: true })
  amount: Types.Decimal128;

  @Prop({ type: Types.ObjectId, ref: 'Passenger', required: true })
  passengerId: Types.ObjectId;

  // Optional: Only used for deductions to pay a specific bus company
  @Prop({ type: Types.ObjectId, ref: 'BusCompany', default: null })
  companyId?: Types.ObjectId;

  // Optional: Link to Stripe Payment Intent ID for top-ups
  @Prop({ type: String, default: null })
  stripePaymentIntentId?: string;

  // Optional: Link to the journey for deductions
  @Prop({ type: Types.ObjectId, ref: 'Journey', default: null })
  journeyId?: Types.ObjectId;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
