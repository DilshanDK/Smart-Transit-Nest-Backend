import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeConnectService {
  private readonly stripe: any;
  private readonly logger = new Logger(StripeConnectService.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!apiKey) {
      throw new Error(
        'STRIPE_SECRET_KEY is not defined in environment variables',
      );
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2023-10-16' as any, // Using an older version type trick for compatibility, or check exact SDK version
    });
  }

  async createPaymentIntent(amount: number, customerId?: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents (or lowest denomination)
        currency: 'lkr',
        customer: customerId,
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          passengerId: customerId || '', // Store the passenger ID here!
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        id: paymentIntent.id,
      };
    } catch (error) {
      this.logger.error('Failed to create PaymentIntent', error);
      throw new InternalServerErrorException('Failed to initialize payment');
    }
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): any {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET not set. Cannot verify webhook signature safely.',
      );
      throw new Error('Webhook secret is not configured.');
    }

    try {
      return this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      this.logger.error(
        `Webhook signature verification failed: ${err.message}`,
      );
      throw err;
    }
  }
}
