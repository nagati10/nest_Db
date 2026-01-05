import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type GoogleCalendarTokenDocument = HydratedDocument<GoogleCalendarToken>;

@Schema({ timestamps: true, versionKey: false })
export class GoogleCalendarToken {
  @ApiProperty({ description: 'Identifiant' })
  _id: string;

  @ApiProperty({ description: 'ID de l\'utilisateur' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @ApiProperty({ description: 'Token d\'accès OAuth2' })
  @Prop({ required: true, select: false })
  accessToken: string;

  @ApiProperty({ description: 'Token de rafraîchissement OAuth2' })
  @Prop({ required: true, select: false })
  refreshToken: string;

  @ApiProperty({ description: 'Date d\'expiration du token' })
  @Prop({ required: true })
  expiryDate: Date;

  @ApiProperty({ description: 'ID du calendrier Google utilisé' })
  @Prop({ default: 'primary' })
  calendarId: string;

  @ApiProperty({ description: 'Email du compte Google' })
  @Prop()
  email?: string;

  @ApiProperty({ description: 'Synchronisation activée' })
  @Prop({ default: true })
  isEnabled: boolean;

  @ApiProperty({ description: 'Dernière synchronisation' })
  @Prop()
  lastSyncAt?: Date;

  @ApiProperty({ description: 'Dernière synchronisation bidirectionnelle' })
  @Prop()
  lastBidirectionalSyncAt?: Date;

  @ApiProperty({ description: 'Synchronisation bidirectionnelle activée' })
  @Prop({ default: false })
  bidirectionalSync: boolean;

  @ApiProperty({ description: 'Scope OAuth2' })
  @Prop([String])
  scope: string[];

  createdAt: Date;
  updatedAt: Date;
}

export const GoogleCalendarTokenSchema = SchemaFactory.createForClass(GoogleCalendarToken);

// Index pour les requêtes fréquentes
GoogleCalendarTokenSchema.index({ userId: 1 });
GoogleCalendarTokenSchema.index({ email: 1 });

