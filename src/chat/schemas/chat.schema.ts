// src/chat/schemas/chat.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type ChatDocument = HydratedDocument<Chat>;

@Schema({ timestamps: true , versionKey : false })
export class Chat {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Candidate user ID' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  candidate: Types.ObjectId;

  @ApiProperty({ example: '507f1f77bcf86cd799439012', description: 'Entreprise user ID' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  entreprise: Types.ObjectId;

  @ApiProperty({ example: '507f1f77bcf86cd799439013', description: 'Offer ID' })
  @Prop({ type: Types.ObjectId, ref: 'Offre', required: true })
  offer: Types.ObjectId;

  @ApiProperty({ example: false, description: 'Is chat blocked' })
  @Prop({ type: Boolean, default: false })
  isBlocked: boolean;

  @ApiProperty({ example: '507f1f77bcf86cd799439012', description: 'User who blocked the chat' })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  blockedBy: Types.ObjectId;

  @ApiProperty({ example: 'Harassment', description: 'Reason for blocking' })
  @Prop({ type: String })
  blockReason: string;

  @ApiProperty({ example: false, description: 'Is chat deleted' })
  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'User who deleted the chat' })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  deletedBy: Types.ObjectId;

  @ApiProperty({ example: new Date(), description: 'Last activity timestamp' })
  @Prop({ type: Date, default: Date.now })
  lastActivity: Date;

  @ApiProperty({ example: 'Hello, I am interested in this offer', description: 'Last message preview' })
  @Prop({ type: String })
  lastMessage: string;

  @ApiProperty({ example: 'text', description: 'Type of last message' })
  @Prop({ type: String, enum: ['text', 'image', 'video', 'audio', 'emoji'], default: 'text' })
  lastMessageType: string;

  @ApiProperty({ example: 5, description: 'Unread message count for candidate' })
  @Prop({ type: Number, default: 0 })
  unreadCandidate: number;

  @ApiProperty({ example: 3, description: 'Unread message count for entreprise' })
  @Prop({ type: Number, default: 0 })
  unreadEntreprise: number;

  @ApiProperty({ example: true, description: 'Is candidate accepted for this offer' })
  @Prop({ type: Boolean, default: false })
  isAccepted: boolean;

  @ApiProperty({ example: new Date(), description: 'Acceptance timestamp' })
  @Prop({ type: Date })
  acceptedAt: Date;

  @Prop([{ type: Types.ObjectId, ref: 'Chat' }])
  chats: Types.ObjectId[];
  
  @Prop({ type: Boolean, default: false })
  isOnline: boolean;
  
  @Prop({ type: Date })
  lastSeen: Date;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

// Index for better query performance
ChatSchema.index({ candidate: 1, entreprise: 1, offer: 1 }, { unique: true });
ChatSchema.index({ lastActivity: -1 });
ChatSchema.index({ isBlocked: 1, isDeleted: 1 });