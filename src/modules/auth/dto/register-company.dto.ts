import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterCompanyDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
