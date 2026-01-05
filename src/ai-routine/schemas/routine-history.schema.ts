import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type RoutineHistoryDocument = HydratedDocument<RoutineHistory>;

@Schema({ timestamps: true, versionKey: false })
export class RoutineHistory {
  @ApiProperty({ description: 'ID de l\'utilisateur' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @ApiProperty({ description: 'Date de début de la semaine analysée' })
  @Prop({ required: true, type: Date })
  weekStart: Date;

  @ApiProperty({ description: 'Date de fin de la semaine analysée' })
  @Prop({ required: true, type: Date })
  weekEnd: Date;

  @ApiProperty({ description: 'Score d\'équilibre (0-100)' })
  @Prop({ required: true, min: 0, max: 100 })
  scoreEquilibre: number;

  @ApiProperty({ description: 'Décomposition du score' })
  @Prop({ type: Object })
  scoreBreakdown: {
    baseScore: number;
    workStudyBalance: number;
    restPenalty: number;
    conflictPenalty: number;
    overloadPenalty: number;
    bonuses: number;
  };

  @ApiProperty({ description: 'Statistiques hebdomadaires' })
  @Prop({ type: Object, required: true })
  statistics: {
    heuresTravail: number;
    heuresEtudes: number;
    heuresRepos: number;
    heuresActivites: number;
    heuresTotales: number;
    repartition: {
      pourcentageTravail: number;
      pourcentageEtudes: number;
      pourcentageRepos: number;
      pourcentageActivites: number;
    };
  };

  @ApiProperty({ description: 'Nombre de conflits détectés' })
  @Prop({ default: 0 })
  conflictCount: number;

  @ApiProperty({ description: 'Nombre de jours surchargés' })
  @Prop({ default: 0 })
  overloadedDaysCount: number;

  @ApiProperty({ description: 'Heures disponibles calculées' })
  @Prop({ default: 0 })
  availableHours: number;

  @ApiProperty({ description: 'Recommandations générées' })
  @Prop({ type: [Object] })
  recommandations: any[];

  @ApiProperty({ description: 'Suggestions d\'optimisation' })
  @Prop({ type: [Object] })
  suggestionsOptimisation: any[];

  @ApiProperty({ description: 'Statut de santé de la routine' })
  @Prop({ 
    type: String, 
    enum: ['excellent', 'bon', 'moyen', 'faible', 'critique'],
    default: 'moyen' 
  })
  healthStatus: string;

  @ApiProperty({ description: 'Problèmes principaux identifiés' })
  @Prop({ type: [String], default: [] })
  mainIssues: string[];

  @ApiProperty({ description: 'Points forts identifiés' })
  @Prop({ type: [String], default: [] })
  mainStrengths: string[];

  @ApiProperty({ description: 'Date de création' })
  createdAt: Date;

  @ApiProperty({ description: 'Date de mise à jour' })
  updatedAt: Date;
}

export const RoutineHistorySchema = SchemaFactory.createForClass(RoutineHistory);

// Index pour optimiser les requêtes
RoutineHistorySchema.index({ userId: 1, weekStart: -1 });
RoutineHistorySchema.index({ userId: 1, scoreEquilibre: -1 });
RoutineHistorySchema.index({ createdAt: -1 });

