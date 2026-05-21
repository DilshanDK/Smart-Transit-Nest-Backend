import { IsNumber, IsPositive } from 'class-validator';

export class CreateIntentDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}
