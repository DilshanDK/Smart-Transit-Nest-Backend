import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import {
  Transaction,
  TransactionDocument,
  TransactionType,
} from '../schemas/transaction.schema';
import {
  Passenger,
  PassengerDocument,
} from '../../auth/schemas/passenger.schema';
import {
  BusCompany,
  BusCompanyDocument,
} from '../../auth/schemas/bus-company.schema';

@Injectable()
export class WalletLedgerService {
  private readonly logger = new Logger(WalletLedgerService.name);

  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Passenger.name)
    private readonly passengerModel: Model<PassengerDocument>,
    @InjectModel(BusCompany.name)
    private readonly busCompanyModel: Model<BusCompanyDocument>,
  ) {}

  /**
   * Deducts fare from passenger wallet and credits it to the bus company
   */
  async deductFare(
    passengerId: string | Types.ObjectId,
    amount: number,
    companyId: string | Types.ObjectId,
    journeyId: string | Types.ObjectId,
    session: ClientSession,
  ): Promise<TransactionDocument> {
    // 1. Get passenger and check balance
    const passenger = await this.passengerModel
      .findById(passengerId)
      .session(session);
    if (!passenger) {
      throw new NotFoundException(
        `Passenger ${passengerId.toString()} not found`,
      );
    }

    const currentBalance = parseFloat(
      passenger.walletBalance?.toString() || '0',
    );
    if (currentBalance < amount) {
      throw new HttpException(
        'Insufficient wallet balance',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // 2. Deduct fare from passenger
    await this.passengerModel.findByIdAndUpdate(
      passengerId,
      { $inc: { walletBalance: -amount } },
      { session },
    );

    // 3. Credit fare to company pending balance
    if (companyId) {
      await this.busCompanyModel.findByIdAndUpdate(
        companyId,
        { $inc: { pendingLedgerBalance: amount } },
        { session },
      );
    }

    // 4. Create deduction transaction
    const tx = new this.transactionModel({
      type: TransactionType.JOURNEY_DEDUCTION,
      amount: Types.Decimal128.fromString(amount.toString()),
      passengerId: new Types.ObjectId(passengerId),
      companyId: companyId ? new Types.ObjectId(companyId) : null,
      journeyId: new Types.ObjectId(journeyId),
    });

    return tx.save({ session });
  }

  /**
   * Credits a passenger's wallet (e.g., from a Stripe webhook)
   * This operation should ideally be atomic.
   */
  async creditFromTopUp(
    passengerId: string | Types.ObjectId,
    amount: number,
    stripePaymentIntentId: string,
  ): Promise<void> {
    const session: ClientSession =
      await this.transactionModel.db.startSession();
    session.startTransaction();

    try {
      // 1. Check if this payment intent was already processed (Idempotency check)
      const existingTx = await this.transactionModel.findOne(
        { stripePaymentIntentId },
        null,
        { session },
      );

      if (existingTx) {
        this.logger.warn(
          `Payment Intent ${stripePaymentIntentId} already processed. Skipping.`,
        );
        await session.abortTransaction();
        await session.endSession();
        return;
      }

      // 2. Increment wallet balance
      // We use $inc to ensure atomic updates at the database level instead of read-modify-write
      const passenger = await this.passengerModel.findByIdAndUpdate(
        passengerId,
        {
          $inc: { walletBalance: amount },
        },
        { new: true, session },
      );

      if (!passenger) {
        throw new NotFoundException(
          `Passenger ${passengerId.toString()} not found`,
        );
      }

      // 3. Record the transaction
      const tx = new this.transactionModel({
        type: TransactionType.WALLET_TOPUP,
        amount: Types.Decimal128.fromString(amount.toString()),
        passengerId: new Types.ObjectId(passengerId),
        stripePaymentIntentId,
      });

      await tx.save({ session });

      await session.commitTransaction();
      this.logger.log(
        `Credited LKR ${amount} to passenger ${passengerId.toString()}`,
      );
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Failed to credit wallet from top up', error);
      throw new InternalServerErrorException('Wallet credit failed');
    } finally {
      await session.endSession();
    }
  }

  /**
   * Gets the wallet transaction history for a passenger
   */
  async getPassengerTransactions(passengerId: string) {
    return this.transactionModel
      .find({ passengerId: new Types.ObjectId(passengerId) })
      .sort({ createdAt: -1 })
      .exec();
  }
}
