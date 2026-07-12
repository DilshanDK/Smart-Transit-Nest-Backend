import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';
import { StripeConnectService } from './services/stripe-connect.service';
@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  async getPassengerTransactions(passengerId: string) {
    return this.transactionModel
      .find({ passengerId: new Types.ObjectId(passengerId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: any,
    passengerId: string,
  ) {
    // Delegate to StripeConnectService which handles the Stripe SDK call
    return await this.stripeConnectService.createPaymentIntent(
      amount,
      passengerId,
    );
  }
}
