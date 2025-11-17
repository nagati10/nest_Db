// src/chat/chat.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Delete,
  Patch,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path from 'path';
import { Types } from 'mongoose';

@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Create or get existing chat' })
  @ApiResponse({ status: 201, description: 'Chat created or retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User or offer not found' })
  @ApiResponse({ status: 403, description: 'User blocked from offer' })
  async createOrGetChat(
    @Body() createChatDto: CreateChatDto,
    @CurrentUser() user: any,
  ) {
    try {
      return await this.chatService.createOrGetChat(createChatDto, user._id);
    } catch (error) {
      if (error.status === 404 || error.status === 403) {
        throw new HttpException(error.message, error.status);
      }
      throw new HttpException('Problem creating chat', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

@Post(':chatId/message')
@ApiOperation({ summary: 'Send message in chat' })
@ApiResponse({ status: 201, description: 'Message sent successfully' })
@ApiResponse({ status: 404, description: 'Chat not found' })
@ApiResponse({ status: 403, description: 'Chat blocked or access denied' })
async sendMessage(
  @Param('chatId') chatId: string,
  @Body() sendMessageDto: SendMessageDto,
  @CurrentUser() user: any,
) {
  try {
    const message = await this.chatService.sendMessage(chatId, user._id, sendMessageDto);
    return {
      success: true,
      data: message,
      message: 'Message sent successfully'
    };
  } catch (error) {
    if (error.status === 404 || error.status === 403) {
      throw new HttpException(error.message, error.status);
    }
    throw new HttpException('Problem sending message', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

  @Get('my-chats')
  @ApiOperation({ summary: 'Get all user chats' })
  @ApiResponse({ status: 200, description: 'Returns user chats' })
  async getUserChats(@CurrentUser() user: any) {
    return await this.chatService.getUserChats(user._id);
  }

@Get(':chatId/messages')
@ApiOperation({ summary: 'Get chat messages with pagination' })
@ApiResponse({ status: 200, description: 'Returns chat messages' })
@ApiResponse({ status: 404, description: 'Chat not found' })
async getChatMessages(
  @Param('chatId') chatId: string,
  @CurrentUser() user: any,
  @Query('page') page: number = 1,
  @Query('limit') limit: number = 50,
) {
  try {
    const result = await this.chatService.getChatMessages(chatId, user._id, page, limit);
    return {
      success: true,
      data: result,
      message: 'Messages retrieved successfully'
    };
  } catch (error) {
    if (error.status === 404) {
      throw new HttpException(error.message, error.status);
    }
    throw new HttpException('Problem fetching messages', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

  @Get(':chatId')
  @ApiOperation({ summary: 'Get chat by ID' })
  @ApiResponse({ status: 200, description: 'Returns chat' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  async getChatById(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
  ) {
    try {
      return await this.chatService.getChatById(chatId, user._id);
    } catch (error) {
      if (error.status === 404) {
        throw new HttpException(error.message, error.status);
      }
      throw new HttpException('Problem fetching chat', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':chatId/block')
  @ApiOperation({ summary: 'Block chat (entreprise only)' })
  @ApiResponse({ status: 200, description: 'Chat blocked successfully' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  @ApiResponse({ status: 403, description: 'Only entreprise can block' })
  async blockChat(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
    @Body() updateChatDto: UpdateChatDto,
  ) {
    try {
      return await this.chatService.blockChat(chatId, user._id, updateChatDto.blockReason);
    } catch (error) {
      if (error.status === 404 || error.status === 403) {
        throw new HttpException(error.message, error.status);
      }
      throw new HttpException('Problem blocking chat', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':chatId/unblock')
  @ApiOperation({ summary: 'Unblock chat (entreprise only)' })
  @ApiResponse({ status: 200, description: 'Chat unblocked successfully' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  @ApiResponse({ status: 403, description: 'Only entreprise can unblock' })
  async unblockChat(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
  ) {
    try {
      return await this.chatService.unblockChat(chatId, user._id);
    } catch (error) {
      if (error.status === 404 || error.status === 403) {
        throw new HttpException(error.message, error.status);
      }
      throw new HttpException('Problem unblocking chat', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':chatId/accept')
  @ApiOperation({ summary: 'Accept candidate (entreprise only)' })
  @ApiResponse({ status: 200, description: 'Candidate accepted successfully' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  @ApiResponse({ status: 403, description: 'Only entreprise can accept' })
  async acceptCandidate(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
  ) {
    try {
      return await this.chatService.acceptCandidate(chatId, user._id);
    } catch (error) {
      if (error.status === 404 || error.status === 403) {
        throw new HttpException(error.message, error.status);
      }
      throw new HttpException('Problem accepting candidate', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('can-call/:offerId')
  @ApiOperation({ summary: 'Check if user can make call for offer' })
  @ApiResponse({ status: 200, description: 'Returns call permission' })
  async canMakeCall(
    @Param('offerId') offerId: string,
    @CurrentUser() user: any,
  ) {
    try {
      const canCall = await this.chatService.canMakeCall(offerId, user._id);
      return { canCall };
    } catch (error) {
      throw new HttpException('Problem checking call permission', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':chatId')
  @ApiOperation({ summary: 'Delete chat' })
  @ApiResponse({ status: 200, description: 'Chat deleted successfully' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async deleteChat(
    @Param('chatId') chatId: string,
    @CurrentUser() user: any,
  ) {
    try {
      return await this.chatService.deleteChat(chatId, user._id);
    } catch (error) {
      if (error.status === 404 || error.status === 403) {
        throw new HttpException(error.message, error.status);
      }
      throw new HttpException('Problem deleting chat', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

// Add to chat.controller.ts
// In chat.controller.ts
@Post('upload')
@ApiBearerAuth()
@ApiOperation({ summary: 'Upload chat media file' })
@ApiConsumes('multipart/form-data')
@ApiBody({
  description: 'Chat media file (image, video, audio)',
  type: 'multipart/form-data',
  schema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        format: 'binary',
      },
    },
  },
})





@Post('upload')
@ApiBearerAuth()
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
@ApiResponse({ status: 201, description: 'File uploaded successfully' })
@ApiResponse({ status: 400, description: 'Invalid file type' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@UseGuards(JwtAuthGuard)
@UseInterceptors(FileInterceptor('file', {
  storage: diskStorage({
    destination: './uploads/chat',
    filename: (req, file, cb) => {
      const uniqueName = `chat-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Allow images, videos, and audio files
    if (file.mimetype.startsWith('image/') || 
        file.mimetype.startsWith('video/') || 
        file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image, video, and audio files are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for videos
  }
}))
async uploadMedia(
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() user: any,
) {
  try {
    if (!file) {
      throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
    }

    // Get the base URL (you might want to configure this properly for production)
    const baseUrl = process.env.BASE_URL || 'http://localhost:3005';
    
    return {
      url: `${baseUrl}/uploads/chat/${file.filename}`, // Full URL for client access
      fileName: file.originalname,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`
    };
  } catch (error) {
    if (error.status === 400) {
      throw new HttpException(error.message, error.status);
    }
    throw new HttpException('Problem uploading file', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

@Patch(':chatId/mark-read')
@ApiOperation({ summary: 'Mark messages as read' })
@ApiResponse({ status: 200, description: 'Messages marked as read' })
@ApiResponse({ status: 404, description: 'Chat not found' })
@ApiResponse({ status: 403, description: 'Access denied' })
async markMessagesAsRead(
  @Param('chatId') chatId: string,
  @CurrentUser() user: any,
) {
  try {
    return await this.chatService.markMessagesAsRead(chatId, user._id);
  } catch (error) {
    if (error.status === 404 || error.status === 403) {
      throw new HttpException(error.message, error.status);
    }
    throw new HttpException('Problem marking messages as read', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

}