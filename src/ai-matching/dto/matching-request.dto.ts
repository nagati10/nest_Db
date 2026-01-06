import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DisponibiliteDto {
  @ApiProperty({ 
    description: 'Jour de la semaine', 
    example: 'Lundi',
    enum: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  })
  @IsString()
  jour: string;

  @ApiProperty({ description: 'Heure de début', example: '09:00' })
  @IsString()
  heureDebut: string;

  @ApiProperty({ description: 'Heure de fin', example: '17:00', required: false })
  @IsString()
  @IsOptional()
  heureFin?: string;
}

export class MatchingRequestDto {
  @ApiProperty({ description: 'ID de l\'étudiant' })
  @IsString()
  studentId: string;

  @ApiProperty({ 
    description: 'Liste des IDs d\'offres à analyser (optionnel, sinon toutes les offres actives)',
    type: [String],
    required: false 
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  offreIds?: string[];

  @ApiProperty({ 
    description: 'Disponibilités de l\'étudiant',
    type: [DisponibiliteDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DisponibiliteDto)
  disponibilites: DisponibiliteDto[];

  @ApiProperty({ 
    description: 'Préférences supplémentaires (type de job, ville, etc.)',
    required: false 
  })
  @IsOptional()
  preferences?: {
    jobType?: string;
    city?: string;
    minSalary?: string;
    maxDistance?: number;
  };
}

