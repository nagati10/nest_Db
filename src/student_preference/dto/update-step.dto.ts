import { IsNotEmpty, IsNumber, Min, Max, IsObject, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateStepDto {
  @ApiProperty({ 
    description: 'Numéro de l\'étape (1-5)', 
    example: 1,
    minimum: 1,
    maximum: 5 
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  step: number;

  @ApiProperty({ 
    description: 'Données de l\'étape', 
    example: { 
      study_level: 'licence_1', 
      study_domain: 'informatique' 
    } 
  })
  @IsNotEmpty()
  @IsObject()
  data: any;

  @ApiProperty({ 
    description: 'Marquer comme complété', 
    example: false,
    required: false 
  })
  @IsOptional()
  @IsBoolean()
  mark_completed?: boolean;
}