// src/chat/dto/update-chat.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateChatDto } from './create-chat.dto';
import { IsBoolean, IsOptional, IsString, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateChatDto extends PartialType(CreateChatDto) {
  @ApiProperty({ example: true, description: 'Block chat', required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isBlocked?: boolean;

  @ApiProperty({ example: 'Harassment', description: 'Block reason', required: false })
  @IsOptional()
  @IsString()
  blockReason?: string;

  @ApiProperty({ example: true, description: 'Accept candidate', required: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isAccepted?: boolean;
}