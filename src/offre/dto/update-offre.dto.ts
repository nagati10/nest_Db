import { PartialType } from '@nestjs/swagger';
import { CreateOffreDto } from './create-offre.dto';
import { IsOptional, IsBoolean, IsArray, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JobType, Shift } from '../schemas/offre.schema';
import { Transform } from 'class-transformer';

export class UpdateOffreDto extends PartialType(CreateOffreDto) {
  @ApiProperty({ example: true, description: 'Whether the offer is active', required: false })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1) return true;
    if (value === 'false' || value === false || value === 0) return false;
    return value;
  })
  isActive?: boolean;

  @ApiProperty({ 
    example: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'], 
    description: 'Array of offer image URLs',
    required: false 
  })
  @IsArray()
  @IsOptional()
  images?: string[];

  @ApiProperty({ example: 150, description: 'Number of views', required: false })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return Number(value);
  })
  viewCount?: number;

  @ApiProperty({ example: 25, description: 'Number of likes', required: false })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return Number(value);
  })
  likeCount?: number;

  @ApiProperty({ 
    enum: JobType, 
    example: JobType.JOB, 
    description: 'Type of job',
    required: false 
  })
  @IsEnum(JobType)
  @IsOptional()
  jobType?: JobType;

  @ApiProperty({ 
    enum: Shift, 
    example: Shift.JOUR, 
    description: 'Work shift',
    required: false 
  })
  @IsEnum(Shift)
  @IsOptional()
  shift?: Shift;

}