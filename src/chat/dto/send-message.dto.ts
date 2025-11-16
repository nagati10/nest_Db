// src/chat/dto/send-message.dto.ts
import { IsNotEmpty, IsMongoId, IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MessageType } from '../schemas/message.schema';
import { Transform } from 'class-transformer';

export class SendMessageDto {
  @ApiProperty({ example: 'Hello, I am interested', description: 'Message content' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ enum: MessageType, example: MessageType.TEXT, description: 'Message type' })
  @IsNotEmpty()
  @IsEnum(MessageType)
  type: MessageType;

  @ApiProperty({ example: 'https://example.com/image.jpg', description: 'Media URL', required: false })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiProperty({ example: 'image.jpg', description: 'File name', required: false })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({ example: '2.5 MB', description: 'File size', required: false })
  @IsOptional()
  @IsString()
  fileSize?: string;

  @ApiProperty({ example: '00:02:30', description: 'Duration for audio/video', required: false })
  @IsOptional()
  @IsString()
  duration?: string;

  @ApiProperty({ example: 'https://example.com/thumb.jpg', description: 'Thumbnail URL', required: false })
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439022', description: 'Replied message ID', required: false })
  @IsOptional()
  @IsMongoId()
  replyTo?: string;
}