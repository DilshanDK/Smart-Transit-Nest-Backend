import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeConnectService } from './services/stripe-connect.service';
import { WalletLedgerService } from './services/wallet-ledger.service';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    AuthModule, // Gives access to Passenger, Driver, BusCompany models
  ],
  controllers: [PaymentController],
  providers: [PaymentService, StripeConnectService, WalletLedgerService],
  exports: [PaymentService, WalletLedgerService],
})
export class PaymentModule {}
