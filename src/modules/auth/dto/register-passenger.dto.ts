import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterPassengerDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @MinLength(6)
  password: string;
}
