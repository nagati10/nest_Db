// update-offre.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateOffreDto } from './create-offre.dto';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOffreDto extends PartialType(CreateOffreDto) {
  @ApiProperty({ example: false, description: 'Whether the offer is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}