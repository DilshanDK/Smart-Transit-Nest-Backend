import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BusCompany, BusCompanyDocument } from '../../auth/schemas/bus-company.schema';
import { StripeConnectService } from '../../payment/services/stripe-connect.service';
import { Transaction, TransactionDocument, TransactionType } from '../../payment/schemas/transaction.schema';

@Injectable()
export class PayoutCronService implements OnModuleInit {
  private readonly logger = new Logger(PayoutCronService.name);

  constructor(
    @InjectModel(BusCompany.name)
    private readonly busCompanyModel: Model<BusCompanyDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  onModuleInit() {
    this.logger.log('PayoutCronService initialized. Nightly payout scheduled for midnight.');
  }

  // Run every day at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleNightlyPayout() {
    this.logger.log('Starting nightly payout process for bus companies...');

    try {
      // Find all onboarded companies with a Stripe Connect Account
      const companies = await this.busCompanyModel.find({
        stripeConnectAccountId: { $exists: true, $ne: null },
        isOnboarded: true,
      });

      this.logger.log(`Found ${companies.length} onboarded bus companies to evaluate.`);

      for (const company of companies) {
        const balance = parseFloat(company.pendingLedgerBalance?.toString() || '0');
        if (balance <= 0) {
          this.logger.log(`Skipping payout for company ${company.companyName} (${company._id}): balance is ${balance}`);
          continue;
        }

        this.logger.log(`Processing payout of LKR ${balance} for company ${company.companyName} (${company._id}) to Stripe account ${company.stripeConnectAccountId}`);

        // Generate a unique idempotency key based on company ID and today's date
        const todayStr = new Date().toISOString().slice(0, 10);
        const idempotencyKey = `payout_${company._id.toString()}_${todayStr}`;

        try {
          // 1. Create the transfer on Stripe
          const transfer = await this.stripeConnectService.createTransfer(
            balance,
            company.stripeConnectAccountId,
            `Daily payout for ${company.companyName} - Date: ${todayStr}`,
            { idempotencyKey },
          );

          this.logger.log(`Stripe transfer successful for ${company.companyName}. Transfer ID: ${transfer.id}`);

          // 2. Deduct the transferred balance atomically in the database
          await this.busCompanyModel.findByIdAndUpdate(
            company._id,
            { $inc: { pendingLedgerBalance: -balance } },
          );

          // 3. Record the payout transaction in our ledger
          const tx = new this.transactionModel({
            type: TransactionType.COMPANY_PAYOUT,
            amount: Types.Decimal128.fromString(balance.toString()),
            companyId: company._id,
            stripeTransferId: transfer.id,
          });
          await tx.save();

          this.logger.log(`Payout transaction recorded successfully for ${company.companyName}`);
        } catch (error) {
          this.logger.error(`Failed to process payout for ${company.companyName}: ${error.message}`, error.stack);
          // We don't throw an error here, so we can attempt payouts for other companies
        }
      }

      this.logger.log('Nightly payout process completed.');
    } catch (error) {
      this.logger.error(`Nightly payout cron job failed: ${error.message}`, error.stack);
    }
  }
}
