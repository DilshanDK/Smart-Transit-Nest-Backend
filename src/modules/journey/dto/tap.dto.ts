import { IsString, IsEnum, IsNumber, IsNotEmpty } from 'class-validator';

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
}
