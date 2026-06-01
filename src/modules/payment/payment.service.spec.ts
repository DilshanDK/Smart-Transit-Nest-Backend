import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { getModelToken } from '@nestjs/mongoose';
import { Transaction } from './schemas/transaction.schema';

describe('PaymentService', () => {
  let service: PaymentService;

  const mockTransactionModel = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getModelToken(Transaction.name),
          useValue: mockTransactionModel,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
