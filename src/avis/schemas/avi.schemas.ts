import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type AvisDocument = HydratedDocument<Avis>;

@Schema({ timestamps: true, versionKey: false })
export class Avis {
  @ApiProperty({ description: 'Identifiant' })
  _id: string;

  @ApiProperty({ description: 'L\'utilisateur concerné' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @ApiProperty({ description: 'Nom de la personne qui donne l\'avis', example: 'John Doe' })
  @Prop({ required: true })
  nom: string;

  @ApiProperty({ description: 'Rating de 1 à 5 étoiles', example: 5, minimum: 1, maximum: 5 })
  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @ApiProperty({ description: 'Commentaire', example: 'Excellent service !' })
  @Prop({ required: true })
  commentaire: string;

  @ApiProperty({ description: 'Avis anonyme ou non', example: false })
  @Prop({ required: true, default: false })
  is_Anonyme: boolean;

  @ApiProperty({ description: 'Date de l\'avis', example: '2024-01-15' })
  @Prop({ required: true, default: Date.now })
  date: Date;
}

export const AvisSchema = SchemaFactory.createForClass(Avis);