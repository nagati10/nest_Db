import { IsString, IsNotEmpty, IsNumber, Min, Max, IsBoolean, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAvisDto {
  @ApiProperty({ description: 'Nom de la personne qui donne l\'avis', example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  nom: string;

  @ApiProperty({ description: 'Rating de 1 à 5 étoiles', example: 5, minimum: 1, maximum: 5 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ description: 'Commentaire', example: 'Excellent service !' })
  @IsNotEmpty()
  @IsString()
  commentaire: string;

  @ApiProperty({ description: 'Avis anonyme ou non', example: false, required: false })
  @IsOptional()
  @IsBoolean()
  is_Anonyme?: boolean;

  @ApiProperty({ description: 'Date de l\'avis', example: '2024-01-15', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;
}