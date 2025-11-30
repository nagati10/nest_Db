// src/user/dto/create-profile-from-cv.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateProfileFromCvDto {
  @ApiPropertyOptional({ description: 'Name extracted from CV' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Email extracted from CV' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone extracted from CV' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Experience lines extracted from CV',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  experience?: string[];

  @ApiPropertyOptional({
    description: 'Education lines extracted from CV',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  education?: string[];

  @ApiPropertyOptional({
    description: 'Skills extracted from CV',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];
}
