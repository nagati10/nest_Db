import { IsString, IsNotEmpty, IsEnum, IsDateString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EventType } from '../schemas/evenement.schema';

export class CreateEvenementDto {
  @ApiProperty({ description: 'Nom de l\'événement', example: 'Cours Math' })
  @IsNotEmpty()
  @IsString()
  titre: string;

  @ApiProperty({ description: 'Type d\'événement', enum: EventType, example: EventType.COURS })
  @IsNotEmpty()
  @IsEnum(EventType)
  type: EventType;

  @ApiProperty({ description: 'Date de l\'événement', example: '2024-01-15' })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Heure de début', example: '09:00' })
  @IsNotEmpty()
  @IsString()
  heureDebut: string;

  @ApiProperty({ description: 'Heure de fin', example: '10:30' })
  @IsNotEmpty()
  @IsString()
  heureFin: string;

  @ApiProperty({ description: 'Lieu', example: 'Room 204', required: false })
  @IsOptional()
  @IsString()
  lieu?: string;

  @ApiProperty({ description: 'Tarif horaire (pour les jobs)', example: 20.5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tarifHoraire?: number;

  @ApiProperty({ description: 'Couleur pour affichage', example: '#FF5733', required: false })
  @IsOptional()
  @IsString()
  couleur?: string;
}