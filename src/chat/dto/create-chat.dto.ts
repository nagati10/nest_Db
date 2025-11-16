// src/chat/dto/create-chat.dto.ts
import { IsNotEmpty, IsMongoId, IsOptional, IsBoolean, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateChatDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439012', description: 'Entreprise user ID' })
  @IsNotEmpty()
  @IsMongoId()
  entreprise: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439013', description: 'Offer ID' })
  @IsNotEmpty()
  @IsMongoId()
  offer: string;
}