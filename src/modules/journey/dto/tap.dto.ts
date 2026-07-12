import { IsString, IsEnum, IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class TapDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsEnum(['NFC', 'QR'])
  mode: 'NFC' | 'QR';

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  @IsOptional()
  offlineTimestamp?: string;
}
