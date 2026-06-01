import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
  ) {}

  async getPassengerTransactions(passengerId: string) {
    return this.transactionModel
      .find({ passengerId: new Types.ObjectId(passengerId) })
      .sort({ createdAt: -1 })
      .exec();
  }
}
