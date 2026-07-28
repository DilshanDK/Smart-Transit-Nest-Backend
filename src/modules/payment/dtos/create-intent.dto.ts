import { IsNumber, IsPositive, IsString, IsOptional, IsObject } from 'class-validator';

export class CreateIntentDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
