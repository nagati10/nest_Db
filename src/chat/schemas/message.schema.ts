import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type MessageDocument = HydratedDocument<Message>;

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  EMOJI = 'emoji'
}

@Schema({ timestamps: true, versionKey: false })
export class Message {
  @ApiProperty({ example: '507f1f77bcf86cd799439021', description: 'Chat ID' })
  @Prop({ type: Types.ObjectId, ref: 'Chat', required: true })
  chat: Types.ObjectId;

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Sender user ID' })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @ApiProperty({ enum: MessageType, example: MessageType.TEXT, description: 'Message type' })
  @Prop({ type: String, enum: MessageType, required: true })
  type: MessageType;

  @ApiProperty({ example: 'Hello, I am interested in this position', description: 'Message content for text/emoji' })
  @Prop({ type: String })
  content: string;

  @ApiProperty({ example: 'https://example.com/image.jpg', description: 'Media file URL' })
  @Prop({ type: String })
  mediaUrl: string;

  @ApiProperty({ example: 'image.jpg', description: 'Original filename' })
  @Prop({ type: String })
  fileName: string;

  @ApiProperty({ example: '2.5 MB', description: 'File size' })
  @Prop({ type: String })
  fileSize: string;

  @ApiProperty({ example: '00:02:30', description: 'Audio/video duration' })
  @Prop({ type: String })
  duration: string;

  @ApiProperty({ example: 'https://example.com/thumbnail.jpg', description: 'Video thumbnail URL' })
  @Prop({ type: String })
  thumbnail: string;

  @ApiProperty({ example: false, description: 'Is message read' })
  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @ApiProperty({ example: new Date(), description: 'Read timestamp' })
  @Prop({ type: Date })
  readAt: Date;

  @ApiProperty({ example: false, description: 'Is message deleted' })
  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @ApiProperty({ example: new Date(), description: 'Delete timestamp' })
  @Prop({ type: Date })
  deletedAt: Date;

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'User who deleted the message' })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  deletedBy: Types.ObjectId;

  // For message reactions/status
  @ApiProperty({ example: ['👍', '❤️'], description: 'Message reactions' })
  @Prop([{ type: String }])
  reactions: string[];

  @ApiProperty({ example: '507f1f77bcf86cd799439022', description: 'Replied message ID' })
  @Prop({ type: Types.ObjectId, ref: 'Message' })
  replyTo: Types.ObjectId;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Indexes for better performance
MessageSchema.index({ chat: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ isRead: 1 });
MessageSchema.index({ type: 1 });