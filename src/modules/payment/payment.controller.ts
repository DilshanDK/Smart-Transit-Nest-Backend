import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  Headers,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles } from '../../core/decorators/roles.decorator';
import { StripeConnectService } from './services/stripe-connect.service';
import { WalletLedgerService } from './services/wallet-ledger.service';
import { PaymentService } from './payment.service';
import { CreateIntentDto } from './dtos/create-intent.dto';

@Controller()
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly stripeService: StripeConnectService,
    private readonly walletService: WalletLedgerService,
    private readonly paymentService: PaymentService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('passenger')
  @Get('payment/transactions')
  async getTransactions(@Req() req: any) {
    const passengerId = req.user.userId;
    return this.paymentService.getPassengerTransactions(passengerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('passenger')
  @Post('payment/intent')
  async createIntent(@Body() dto: CreateIntentDto, @Req() req: any) {
    const passengerId = req.user.userId;
    return this.stripeService.createPaymentIntent(dto.amount, passengerId);
  }

  @Post('webhooks/stripe')
  async handleStripeWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    let event;
    try {
      event = this.stripeService.constructWebhookEvent(req.rawBody, signature);
    } catch (err) {
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as any;
        this.logger.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
        
        const passengerId = paymentIntent.metadata?.passengerId;
        if (passengerId) {
          // Stripe amounts are in cents, so divide by 100
          await this.walletService.creditFromTopUp(passengerId, paymentIntent.amount / 100, paymentIntent.id);
        } else {
          this.logger.warn(`No passengerId found in metadata for PaymentIntent ${paymentIntent.id}`);
        }
        break;
      // ... handle other event types
      default:
        this.logger.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    return { received: true };
  }
}
