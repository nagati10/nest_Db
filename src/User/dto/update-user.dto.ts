import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../enums/role.enum';
import { Transform } from 'class-transformer';

export class UpdateUserDto {
  @ApiProperty({ description: 'Nom du producteur', example: 'Najd' })
  @IsNotEmpty()
  @IsString()
  nom: string;

  @ApiProperty({ description: 'Email du producteur', example: 'user@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Contact du producteur', example: '+216 21 000 000' })
  @IsNotEmpty()
  @IsString()
  contact: string;

  @ApiProperty({ description: 'Profile image file', type: 'string', format: 'binary', required: false })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({ description: 'Mode examens activé ou non', example: false, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1) return true;
    if (value === 'false' || value === false || value === 0) return false;
    return value;
  })
  modeExamens?: boolean;

  @ApiProperty({ description: 'Archived status', example: false, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1) return true;
    if (value === 'false' || value === false || value === 0) return false;
    return value;
  })
  is_archive?: boolean;

  @ApiProperty({ description: 'Trust experience points', example: 0, required: false })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return 0;
    return Number(value);
  })
  TrustXP?: number;

  @ApiProperty({ description: 'Organization status', example: false, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1) return true;
    if (value === 'false' || value === false || value === 0) return false;
    return value;
  })
  is_Organization?: boolean;
}