import { IsArray, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MinLength, Min, MaxLength, Matches, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum';
import { Transform, Type } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ description: 'User name', example: 'Najd' })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Name cannot exceed 50 characters' })
  nom: string;

  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Matches(/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, { 
    message: 'Please enter a valid email format' 
  })
  email: string;

  @ApiProperty({ description: 'User password', example: 'StrongP@assw0rd', minLength: 6 })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
  })
  password: string;

  @ApiProperty({ description: 'User role', enum: Role, default: Role.USER, required: false })
  @IsOptional()
  @IsEnum(Role, { message: 'Invalid role provided' })
  role?: Role;
  
  @ApiProperty({ description: 'User contact information', example: '+216 21 000 000' })
  @IsNotEmpty({ message: 'Contact is required' })
  @IsString()
  contact: string;

  @ApiProperty({ description: 'Profile image file', type: 'string', format: 'binary', required: false })
  @IsOptional()
  image?: any;

  @ApiProperty({ description: 'Exam mode enabled or not', example: false, required: false })
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
  @Min(0, { message: 'Trust XP cannot be negative' })
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return 0;
    const num = Number(value);
    return Number.isInteger(num) ? num : Math.floor(num);
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

  @ApiProperty({ description: 'Array of liked offer IDs', example: ['507f1f77bcf86cd799439011'], required: false })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each liked offer must be a valid MongoDB ID' })
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
  likedOffres?: string[];

  @ApiProperty({ description: 'Array of chat IDs', example: ['507f1f77bcf86cd799439011'], required: false })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each chat ID must be a valid MongoDB ID' })
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
  @IsMongoId({ each: true, message: 'Each blocked user must be a valid MongoDB ID' })
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