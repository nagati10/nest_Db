import { IsArray, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum';
import { Transform } from 'class-transformer';

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


  @ApiProperty({ description: 'Array of liked offer IDs', example: [], required: false })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return [];
    }
    // If it's already an array, return as is
    if (Array.isArray(value)) {
      return value;
    }
    // If it's a string, try to parse it as JSON array
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [value]; // Return as single element array
      }
    }
    return value;
  })
  likedOffres?: string[];

  @ApiProperty({ description: 'Array of chat IDs', example: ['507f1f77bcf86cd799439011'], required: false })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [value];
      }
    }
    return value;
  })
  chats?: string[];

  @ApiProperty({ description: 'Array of blocked user IDs', example: ['507f1f77bcf86cd799439011'], required: false })
  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [value];
      }
    }
    return value;
  })
  blockedUsers?: string[];

  @ApiProperty({ description: 'Is user online', example: false, required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1) return true;
    if (value === 'false' || value === false || value === 0) return false;
    return value;
  })
  isOnline?: boolean;

  @ApiProperty({ description: 'Current status', enum: ['active', 'inactive', 'busy'], example: 'active', required: false })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'busy'], { message: 'Status must be active, inactive, or busy' })
  Currentstatus?: string;
}