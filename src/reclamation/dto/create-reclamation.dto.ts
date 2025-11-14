import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReclamationType } from '../schemas/reclamation.schema';

export class CreateReclamationDto {
  @ApiProperty({ description: 'Type de réclamation', enum: ReclamationType, example: ReclamationType.SERVICE })
  @IsNotEmpty()
  @IsEnum(ReclamationType)
  type: ReclamationType;

  @ApiProperty({ description: 'Texte de la réclamation', example: 'Le service était très lent' })
  @IsNotEmpty()
  @IsString()
  text: string;

  @ApiProperty({ description: 'Date de la réclamation', example: '2024-01-15', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ description: 'ID de l\'utilisateur', required: false })
  @IsOptional()
  @IsString()
  userId?: string;
}