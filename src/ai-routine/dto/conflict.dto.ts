import { ApiProperty } from '@nestjs/swagger';
import { EvenementDto } from './routine-input.dto';

export enum ConflictSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export class ConflictDto {
  @ApiProperty({ description: 'Date du conflit', example: '2024-01-15' })
  date: string;

  @ApiProperty({ description: 'Premier événement en conflit' })
  event1: EvenementDto;

  @ApiProperty({ description: 'Deuxième événement en conflit' })
  event2: EvenementDto;

  @ApiProperty({ 
    enum: ConflictSeverity, 
    description: 'Gravité du conflit',
    example: ConflictSeverity.HIGH 
  })
  severity: ConflictSeverity;

  @ApiProperty({ description: 'Suggestion pour résoudre le conflit' })
  suggestion: string;

  @ApiProperty({ description: 'Durée du chevauchement en minutes', example: 30 })
  overlapDuration: number;

  @ApiProperty({ description: 'Impact sur le score', example: -10 })
  scoreImpact: number;
}

export class TimeSlotDto {
  @ApiProperty({ description: 'Jour de la semaine', example: 'Lundi' })
  jour: string;

  @ApiProperty({ description: 'Heure de début', example: '14:00' })
  heureDebut: string;

  @ApiProperty({ description: 'Heure de fin', example: '18:00' })
  heureFin: string;

  @ApiProperty({ description: 'Durée en heures', example: 4 })
  duration: number;

  @ApiProperty({ description: 'Type de créneau', example: 'libre' })
  type: 'libre' | 'occupé' | 'partiellement-libre';
}

export class OverloadedDayDto {
  @ApiProperty({ description: 'Date', example: '2024-01-15' })
  date: string;

  @ApiProperty({ description: 'Jour de la semaine', example: 'Lundi' })
  jour: string;

  @ApiProperty({ description: 'Nombre total d\'heures', example: 14 })
  totalHours: number;

  @ApiProperty({ description: 'Événements de la journée', type: [EvenementDto] })
  evenements: EvenementDto[];

  @ApiProperty({ description: 'Niveau de surcharge', example: 'élevé' })
  level: 'modéré' | 'élevé' | 'critique';

  @ApiProperty({ description: 'Recommandations', type: [String] })
  recommendations: string[];
}

