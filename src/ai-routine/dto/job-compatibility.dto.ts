import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { TimeSlotDto } from './conflict.dto';

export class CheckJobCompatibilityDto {
  @ApiProperty({ description: 'ID de l\'offre à vérifier', example: '507f1f77bcf86cd799439011' })
  @IsString()
  offreId: string;

  @ApiProperty({ 
    description: 'Date de début de la période d\'analyse', 
    example: '2024-01-15',
    required: false 
  })
  @IsOptional()
  @IsString()
  dateDebut?: string;

  @ApiProperty({ 
    description: 'Date de fin de la période d\'analyse', 
    example: '2024-01-22',
    required: false 
  })
  @IsOptional()
  @IsString()
  dateFin?: string;
}

export class JobCompatibilityResponseDto {
  @ApiProperty({ description: 'Score de compatibilité (0-100)', example: 85 })
  score: number;

  @ApiProperty({ description: 'L\'étudiant peut accepter cette offre', example: true })
  available: boolean;

  @ApiProperty({ description: 'Message explicatif' })
  message: string;

  @ApiProperty({ description: 'Heures disponibles par semaine', example: 15 })
  availableHoursPerWeek: number;

  @ApiProperty({ description: 'Meilleurs créneaux disponibles', type: [TimeSlotDto] })
  bestTimeSlots: TimeSlotDto[];

  @ApiProperty({ description: 'Avertissements', type: [String] })
  warnings: string[];

  @ApiProperty({ description: 'Raisons de la compatibilité', type: [String] })
  reasons: string[];

  @ApiProperty({ description: 'Impact estimé sur l\'équilibre (-100 à 100)', example: -5 })
  impactOnBalance: number;

  @ApiProperty({ description: 'Recommandation finale' })
  recommendation: string;
}

export class QuickSuggestionDto {
  @ApiProperty({ description: 'Nouvel événement à ajouter' })
  newEvent: {
    titre: string;
    type: string;
    date: string;
    heureDebut: string;
    heureFin: string;
  };

  @ApiProperty({ description: 'Événements actuels', required: false })
  @IsOptional()
  currentEvents?: any[];
}

export class QuickSuggestionResponseDto {
  @ApiProperty({ 
    description: 'Statut de la suggestion', 
    enum: ['ok', 'warning', 'error'],
    example: 'warning' 
  })
  status: 'ok' | 'warning' | 'error';

  @ApiProperty({ description: 'Message principal' })
  message: string;

  @ApiProperty({ description: 'Conflits détectés', type: [Object], required: false })
  conflicts?: any[];

  @ApiProperty({ description: 'Créneaux alternatifs suggérés', required: false })
  alternatives?: Array<{
    time: string;
    reason: string;
  }>;

  @ApiProperty({ description: 'Impact sur le score d\'équilibre', example: -5 })
  impactScore: number;

  @ApiProperty({ description: 'Recommandations', type: [String] })
  recommendations: string[];
}

