// create-offre.dto.ts
import { IsString, IsArray, IsOptional, IsObject, IsNotEmpty, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

class CoordinatesDto {
  @ApiProperty({ example: 48.8566, description: 'Latitude' })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  lat: number;

  @ApiProperty({ example: 2.3522, description: 'Longitude' })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  lng: number;
}

class LocationDto {
  @ApiProperty({ example: '123 Main Street', description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Paris', description: 'City name' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'France', description: 'Country name' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ 
    example: { lat: 48.8566, lng: 2.3522 }, 
    description: 'Geographic coordinates',
    required: false 
  })
  @IsOptional()
  @Type(() => CoordinatesDto)
  coordinates?: CoordinatesDto;
}

export class CreateOffreDto {
  @ApiProperty({ example: 'Senior Full Stack Developer', description: 'Offer title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ 
    type: 'string', 
    format: 'binary',
    description: 'Offer image file',
    required: false
  })
  @IsOptional()
  imageFile?: any;

  @ApiProperty({ example: 'We are looking for an experienced developer...', description: 'Detailed description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ 
    example: ['javascript', 'react', 'nodejs'], 
    description: 'Tags for categorization',
    required: false,
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(tag => tag.trim());
    }
    return value;
  })
  tags?: string[];

  @ApiProperty({ 
    description: 'Location information',
    example: {
      address: '123 Main Street',
      city: 'Paris', 
      country: 'France',
      coordinates: { lat: 48.8566, lng: 2.3522 }
    }
  })
  @IsObject()
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value;
  })
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiProperty({ example: 'Information Technology', description: 'Offer category', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ example: '50000-70000 EUR', description: 'Salary range', required: false })
  @IsString()
  @IsOptional()
  salary?: string;

  @ApiProperty({ example: 'Tech Solutions Inc.', description: 'Company name', required: false })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiProperty({ example: '2024-12-31', description: 'Expiration date', required: false })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  // Note: createdBy is removed as it will come from JWT token
}