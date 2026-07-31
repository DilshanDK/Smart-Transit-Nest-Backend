import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class LoginDriverDto {
  @IsString()
  @IsNotEmpty()
  loginInput: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  driverId?: string;

  @IsString()
  @IsOptional()
  busRegistration?: string;
}
