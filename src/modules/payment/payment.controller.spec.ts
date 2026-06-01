import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { StripeConnectService } from './services/stripe-connect.service';
import { WalletLedgerService } from './services/wallet-ledger.service';
import { PaymentService } from './payment.service';

describe('PaymentController', () => {
  let controller: PaymentController;

  const mockStripeConnectService = {
    createPaymentIntent: jest.fn(),
    constructWebhookEvent: jest.fn(),
  };

  const mockWalletLedgerService = {
    deductFare: jest.fn(),
    creditFromTopUp: jest.fn(),
    getPassengerTransactions: jest.fn(),
  };

  const mockPaymentService = {
    getPassengerTransactions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: StripeConnectService, useValue: mockStripeConnectService },
        { provide: WalletLedgerService, useValue: mockWalletLedgerService },
        { provide: PaymentService, useValue: mockPaymentService },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
