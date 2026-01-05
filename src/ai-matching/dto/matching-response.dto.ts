import { ApiProperty } from '@nestjs/swagger';

export class MatchingScoreDto {
  @ApiProperty({ description: 'Score de compatibilité (0-100)', example: 85 })
  score: number;

  @ApiProperty({ description: 'Score de disponibilité temporelle', example: 90 })
  timeScore: number;

  @ApiProperty({ description: 'Score de compatibilité des préférences', example: 80 })
  preferenceScore: number;

  @ApiProperty({ description: 'Score basé sur le profil étudiant', example: 85 })
  profileScore: number;
}

export class MatchingReasonDto {
  @ApiProperty({ description: 'Type de raison', example: 'positive' })
  type: 'positive' | 'negative' | 'neutral';

  @ApiProperty({ description: 'Message explicatif', example: 'Vos horaires correspondent parfaitement' })
  message: string;

  @ApiProperty({ description: 'Poids de cette raison (0-1)', example: 0.8 })
  weight: number;
}

export class OffreMatchDto {
  @ApiProperty({ description: 'ID de l\'offre' })
  offreId: string;

  @ApiProperty({ description: 'Titre de l\'offre' })
  titre: string;

  @ApiProperty({ description: 'Entreprise' })
  entreprise: string;

  @ApiProperty({ description: 'Ville' })
  ville: string;

  @ApiProperty({ description: 'Type de job', example: 'stage' })
  jobType: string;

  @ApiProperty({ description: 'Horaire de travail', example: 'Lundi-Vendredi 09:00-17:00' })
  horaire?: string;

  @ApiProperty({ description: 'Scores de matching', type: MatchingScoreDto })
  scores: MatchingScoreDto;

  @ApiProperty({ description: 'Raisons du matching', type: [MatchingReasonDto] })
  reasons: MatchingReasonDto[];

  @ApiProperty({ description: 'Recommandation IA', example: 'Cette offre correspond bien à votre profil' })
  recommendation: string;

  @ApiProperty({ description: 'Rang de cette offre', example: 1 })
  rank: number;
}

export class MatchingResponseDto {
  @ApiProperty({ description: 'ID de l\'étudiant' })
  studentId: string;

  @ApiProperty({ description: 'Nombre total d\'offres analysées', example: 25 })
  totalOffres: number;

  @ApiProperty({ description: 'Offres compatibles triées par score', type: [OffreMatchDto] })
  matches: OffreMatchDto[];

  @ApiProperty({ description: 'Timestamp de l\'analyse' })
  timestamp: string;

  @ApiProperty({ description: 'Résumé de l\'analyse' })
  summary: {
    bestMatch?: OffreMatchDto;
    averageScore: number;
    highScoreCount: number; // Score > 70
    mediumScoreCount: number; // Score 40-70
    lowScoreCount: number; // Score < 40
  };
}

