// src/chat/chat.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
  Delete,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path from 'path';
import { IsMongoId, IsNotEmpty } from 'class-validator';


export class SaveInterviewResultDto {
    @ApiProperty({ example: '507f1f77bcf86cd799439021', description: 'Chat ID' })
    @IsNotEmpty()
    @IsMongoId()
    chat_id: string;

    @ApiProperty({ description: 'Interview analysis data' })
    @IsNotEmpty()
    analysis: any;
}

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Create or get existing chat' })
  @ApiResponse({ status: 200, description: 'Chat created or retrieved successfully' })
  async createOrGetChat(
    @Body() createChatDto: CreateChatDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.chatService.createOrGetChat(createChatDto, userId);
  }

  @Post(':chatId/message')
  @ApiOperation({ summary: 'Send message in chat' })
  @ApiResponse({ status: 200, description: 'Message sent successfully' })
  async sendMessage(
    @Param('chatId') chatId: string,
    @Body() sendMessageDto: SendMessageDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.chatService.sendMessage(chatId, userId, sendMessageDto);
  }

  @Get('my-chats')
  @ApiOperation({ summary: 'Get all user chats' })
  @ApiResponse({ status: 200, description: 'Returns user chats' })
  async getUserChats(@CurrentUser() user: any) {
    const userId = user.userId || user._id || user.id;
    return this.chatService.getUserChats(userId);
  }

  @Get(':chatId/messages')
  @ApiOperation({ summary: 'Get chat messages with pagination' })
  @ApiResponse({ status: 200, description: 'Returns chat messages' })
  async getChatMessages(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.chatService.getChatMessages(chatId, userId, page, limit);
  }

  @Get(':chatId')
  @ApiOperation({ summary: 'Get chat by ID' })
  @ApiResponse({ status: 200, description: 'Returns chat' })
  async getChatById(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.chatService.getChatById(chatId, userId);
  }

  @Patch(':chatId/block')
  @ApiOperation({ summary: 'Block chat (entreprise only)' })
  @ApiResponse({ status: 200, description: 'Chat blocked successfully' })
  async blockChat(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
    @Body() updateChatDto: UpdateChatDto,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.chatService.blockChat(chatId, userId, updateChatDto.blockReason);
  }

  @Patch(':chatId/unblock')
  @ApiOperation({ summary: 'Unblock chat (entreprise only)' })
  @ApiResponse({ status: 200, description: 'Chat unblocked successfully' })
  async unblockChat(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.chatService.unblockChat(chatId, userId);
  }

  @Patch(':chatId/accept')
  @ApiOperation({ summary: 'Accept candidate (entreprise only)' })
  @ApiResponse({ status: 200, description: 'Candidate accepted successfully' })
  async acceptCandidate(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.chatService.acceptCandidate(chatId, userId);
  }

  @Get('can-call/:offerId')
  @ApiOperation({ summary: 'Check if user can make call for offer' })
  @ApiResponse({ status: 200, description: 'Returns call permission' })
  async canMakeCall(
    @Param('offerId') offerId: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.chatService.canMakeCall(offerId, userId);
  }

  @Delete(':chatId')
  @ApiOperation({ summary: 'Delete chat' })
  @ApiResponse({ status: 200, description: 'Chat deleted successfully' })
  async deleteChat(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.chatService.deleteChat(chatId, userId);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload chat media file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Chat media file (image, video, audio)',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Media file to upload (image, video, or audio)',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/chat',
      filename: (req, file, cb) => {
        const uniqueName = `chat-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    }),
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/') || 
          file.mimetype.startsWith('video/') || 
          file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image, video, and audio files are allowed'), false);
      }
    },
    limits: {
      fileSize: 50 * 1024 * 1024,
    }
  }))
  async uploadMedia(@UploadedFile() file: Express.Multer.File) {    
    return {
      url: `uploads/chat/${file.filename}`,
      fileName: file.originalname,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`
    };
  }

  @Patch(':chatId/mark-read')
  @ApiOperation({ summary: 'Mark messages as read' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markMessagesAsRead(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.chatService.markMessagesAsRead(chatId, userId);
  }

  // chat.controller.ts - endpoint with debug logging
  @Post('interview-result')
  @ApiOperation({ summary: 'Save interview result from AI analysis (called by Python backend)' })
  @ApiResponse({ status: 201, description: 'Interview result saved successfully' })
  async saveInterviewResult(
      @Body() dto: SaveInterviewResultDto
  ) {
      console.log('='.repeat(80));
      console.log('🌐 NESTJS_ENDPOINT: /chat/interview-result called');
      console.log('='.repeat(80));
      try {
          console.log(`📥 NESTJS_ENDPOINT: Request body keys: ${Object.keys(dto || {}).join(', ')}`);
          console.log(`📥 NESTJS_ENDPOINT: chat_id=${dto?.chat_id || 'MISSING'}`);
          console.log(`📥 NESTJS_ENDPOINT: analysis present=${!!dto?.analysis}`);
          if (!dto.chat_id) {
              console.log(`❌ NESTJS_ENDPOINT: Missing chat_id`);
              throw new Error('Missing chat_id');
          }
          if (!dto.analysis) {
              console.log(`❌ NESTJS_ENDPOINT: Missing analysis data`);
              throw new Error('Missing analysis data');
          }
          console.log(`🔄 NESTJS_ENDPOINT: Calling chatService.saveInterviewResult...`);
          const result = await this.chatService.saveInterviewResult(dto.chat_id, dto.analysis);
          console.log(`✅ NESTJS_ENDPOINT: Success! Message ID: ${result._id}`);
          console.log('='.repeat(80));
          return result;
      } catch (error) {
          console.log('='.repeat(80));
          console.log(`❌ NESTJS_ENDPOINT: ERROR IN CONTROLLER`);
          console.log(`❌ NESTJS_ENDPOINT: Error type: ${error?.constructor?.name || 'Unknown'}`);
          console.log(`❌ NESTJS_ENDPOINT: Error message: ${error?.message || String(error)}`);
          console.log(`❌ NESTJS_ENDPOINT: Stack trace:`);
          console.error(error);
          console.log('='.repeat(80));
          throw error;
      }
  }
}