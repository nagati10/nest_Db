import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type DisponibiliteDocument = HydratedDocument<Disponibilite>;

export enum JourSemaine {
  LUNDI = 'Lundi',
  MARDI = 'Mardi',
  MERCREDI = 'Mercredi',
  JEUDI = 'Jeudi',
  VENDREDI = 'Vendredi',
  SAMEDI = 'Samedi',
  DIMANCHE = 'Dimanche'
}

@Schema({ timestamps: true, versionKey: false })
export class Disponibilite {
  @ApiProperty({ description: 'Identifiant' })
  _id: string;

  @ApiProperty({ description: 'L\'utilisateur concerné' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @ApiProperty({ description: 'Jour de la semaine', enum: JourSemaine, example: JourSemaine.LUNDI })
  @Prop({ type: String, enum: JourSemaine, required: true })
  jour: JourSemaine;

  @ApiProperty({ description: 'Heure de début', example: '09:00' })
  @Prop({ required: true })
  heureDebut: string;

  @ApiProperty({ description: 'Heure de fin', example: '17:00', required: false })
  @Prop({ required: false })
  heureFin?: string;
}

export const DisponibiliteSchema = SchemaFactory.createForClass(Disponibilite);