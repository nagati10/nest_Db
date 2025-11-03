import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum';

export class CreateUserDto {
  @ApiProperty({ description: 'Nom du producteur', example: 'Najd' })
  @IsNotEmpty()
  @IsString()
  nom: string;

  @ApiProperty({ description: 'Email du producteur', example: 'user@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User password', example: 'StrongP@assw0rd', minLength: 6 })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: 'User role (admin or user)', enum: Role, default: Role.USER, required: false })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty({ description: 'Contact du producteur', example: '+216 21 000 000' })
  @IsNotEmpty()
  @IsString()
  contact: string;

  @ApiProperty({ description: 'Profile image file', type: 'string', format: 'binary', required: false })
  @IsOptional()
  @IsString()
  image?: string;
}