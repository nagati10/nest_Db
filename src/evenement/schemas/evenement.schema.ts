import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type EvenementDocument = HydratedDocument<Evenement>;

export enum EventType {
  COURS = 'cours',
  JOB = 'job',
  DEADLINE = 'deadline'
}

@Schema({ timestamps: true, versionKey: false })
export class Evenement {
  @ApiProperty({ description: 'Identifiant' })
  _id: string;

  @ApiProperty({ description: 'L\'utilisateur concerné' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @ApiProperty({ description: 'Nom de l\'événement', example: 'Cours Math' })
  @Prop({ required: true })
  titre: string;

  @ApiProperty({ description: 'Type d\'événement', enum: EventType, example: EventType.COURS })
  @Prop({ type: String, enum: EventType, required: true })
  type: EventType;

  @ApiProperty({ description: 'Date de l\'événement', example: '2024-01-15' })
  @Prop({ required: true })
  date: Date;

  @ApiProperty({ description: 'Heure de début', example: '09:00' })
  @Prop({ required: true })
  heureDebut: string;

  @ApiProperty({ description: 'Heure de fin', example: '10:30' })
  @Prop({ required: true })
  heureFin: string;

  @ApiProperty({ description: 'Lieu', example: 'Room 204', required: false })
  @Prop({ required: false })
  lieu?: string;

  @ApiProperty({ description: 'Tarif horaire (pour les jobs)', example: 20.5, required: false })
  @Prop({ required: false })
  tarifHoraire?: number;

  @ApiProperty({ description: 'Couleur pour affichage', example: '#FF5733' })
  @Prop({ required: true, default: '#3B82F6' })
  couleur: string;
}

export const EvenementSchema = SchemaFactory.createForClass(Evenement);