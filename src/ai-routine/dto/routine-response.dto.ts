import { ApiProperty } from '@nestjs/swagger';
import { ConflictDto, OverloadedDayDto, TimeSlotDto } from './conflict.dto';

export class RecommendationDto {
  @ApiProperty({ description: 'ID unique de la recommandation' })
  id: string;

  @ApiProperty({ 
    description: 'Type de recommandation',
    enum: ['travail', 'etudes', 'repos', 'activites', 'sante', 'social', 'optimisation', 'planning', 'bienetre']
  })
  type: string;

  @ApiProperty({ description: 'Titre de la recommandation' })
  titre: string;

  @ApiProperty({ description: 'Description détaillée' })
  description: string;

  @ApiProperty({ 
    description: 'Priorité', 
    enum: ['haute', 'moyenne', 'basse'],
    example: 'haute' 
  })
  priorite: 'haute' | 'moyenne' | 'basse';

  @ApiProperty({ description: 'Action suggérée', required: false })
  actionSuggeree?: string;
}

export class SuggestionOptimisationDto {
  @ApiProperty({ description: 'ID unique de la suggestion' })
  id: string;

  @ApiProperty({ description: 'Jour concerné ou période', example: 'Lundi' })
  jour: string;

  @ApiProperty({ 
    description: 'Type d\'optimisation',
    enum: ['deplacement', 'ajout', 'suppression', 'regroupement', 'pause', 'reorganisation']
  })
  type: string;

  @ApiProperty({ description: 'Description de l\'optimisation' })
  description: string;

  @ApiProperty({ description: 'Avantage concret' })
  avantage: string;

  @ApiProperty({ 
    description: 'Impact estimé',
    enum: ['tresPositif', 'positif', 'neutre'],
    example: 'positif' 
  })
  impact: 'tresPositif' | 'positif' | 'neutre';
}

export class AnalyseHebdomadaireDto {
  @ApiProperty({ description: 'Heures de travail', example: 20 })
  heuresTravail: number;

  @ApiProperty({ description: 'Heures d\'études', example: 25 })
  heuresEtudes: number;

  @ApiProperty({ description: 'Heures de repos', example: 45 })
  heuresRepos: number;

  @ApiProperty({ description: 'Heures d\'activités personnelles', example: 10 })
  heuresActivites: number;

  @ApiProperty({ description: 'Total d\'heures', example: 100 })
  heuresTotales: number;

  @ApiProperty({ description: 'Répartition en pourcentages' })
  repartition: {
    pourcentageTravail: number;
    pourcentageEtudes: number;
    pourcentageRepos: number;
    pourcentageActivites: number;
  };
}

export class EnhancedRoutineAnalysisDto {
  @ApiProperty({ description: 'ID unique de l\'analyse' })
  id: string;

  @ApiProperty({ description: 'Date de l\'analyse' })
  dateAnalyse: string;

  @ApiProperty({ description: 'Score d\'équilibre (0-100)', example: 75 })
  scoreEquilibre: number;

  @ApiProperty({ description: 'Méthode de calcul du score' })
  scoreBreakdown: {
    baseScore: number;
    workStudyBalance: number;
    restPenalty: number;
    conflictPenalty: number;
    overloadPenalty: number;
    bonuses: number;
  };

  @ApiProperty({ description: 'Conflits d\'horaires détectés', type: [ConflictDto] })
  conflicts: ConflictDto[];

  @ApiProperty({ description: 'Jours surchargés', type: [OverloadedDayDto] })
  overloadedDays: OverloadedDayDto[];

  @ApiProperty({ description: 'Créneaux disponibles', type: [TimeSlotDto] })
  availableTimeSlots: TimeSlotDto[];

  @ApiProperty({ description: 'Recommandations', type: [RecommendationDto] })
  recommandations: RecommendationDto[];

  @ApiProperty({ description: 'Analyse hebdomadaire' })
  analyseHebdomadaire: AnalyseHebdomadaireDto;

  @ApiProperty({ description: 'Suggestions d\'optimisation', type: [SuggestionOptimisationDto] })
  suggestionsOptimisation: SuggestionOptimisationDto[];

  @ApiProperty({ description: 'Résumé de santé de la routine' })
  healthSummary: {
    status: 'excellent' | 'bon' | 'moyen' | 'faible' | 'critique';
    mainIssues: string[];
    mainStrengths: string[];
  };
}

