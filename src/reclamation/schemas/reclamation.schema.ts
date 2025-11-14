import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type ReclamationDocument = HydratedDocument<Reclamation>;

export enum ReclamationType {
  TECHNICAL = 'technique',
  SERVICE = 'service',
  BILLING = 'facturation',
  OTHER = 'autre'
}

@Schema({ timestamps: true, versionKey: false })
export class Reclamation {
  @ApiProperty({ description: 'Identifiant' })
  _id: string;

  @ApiProperty({ description: 'Type de réclamation', enum: ReclamationType, example: ReclamationType.SERVICE })
  @Prop({ type: String, enum: ReclamationType, required: true })
  type: ReclamationType;

  @ApiProperty({ description: 'Texte de la réclamation', example: 'Le service était très lent' })
  @Prop({ required: true })
  text: string;

  @ApiProperty({ description: 'Date de la réclamation', example: '2024-01-15' })
  @Prop({ required: true, default: Date.now })
  date: Date;

  @ApiProperty({ description: 'Statut de la réclamation', example: 'en_attente' })
  @Prop({ required: true, default: 'en_attente' })
  status: string;

  @ApiProperty({ description: 'Utilisateur associé', required: false })
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  userId?: Types.ObjectId;
}

export const ReclamationSchema = SchemaFactory.createForClass(Reclamation);