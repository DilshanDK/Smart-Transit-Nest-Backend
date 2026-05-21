import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDriverDto {
  @IsString()
  @IsNotEmpty()
  driverId: string;

  @IsString()
  @IsNotEmpty()
  busRegistration: string;
}
