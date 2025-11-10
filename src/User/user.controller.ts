import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus, UseGuards, UseInterceptors, UploadedFile, BadRequestException, NotFoundException, HttpCode } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path from 'path';
import type { UserDocument } from './schemas/user.schema';
import * as fs from 'fs';
import { ResetPasswordDto } from './dto/reset-password-dto';

@Controller('user/me')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'get your profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async findMe(@CurrentUser() user: any) {
    const id = user.userId || user._id || user.id;
    return this.userService.getProfile(id);
  }

  @Get('image/Get')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile image URL' })
  @ApiResponse({ status: 200, description: 'Returns image URL' })
  @ApiResponse({ status: 404, description: 'User has no profile image' })
  async getImage(@CurrentUser() user: UserDocument) {
    if (!user.image) {
      throw new NotFoundException('User has no profile image');
    }
    
    return {
      imageUrl: `http://localhost:3005/${user.image}`,
      filename: user.image
    };
  }

    @Patch()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'update your profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: any ,@Body() updateUserDto: UpdateUserDto) {
    const id = user.userId || user._id || user.id;
    return this.userService.update(id, updateUserDto);
  }

  @Delete()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete current user profile' })
  @ApiResponse({ status: 200, description: 'delete your profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: any ) {
    const id = user.userId || user._id || user.id;
    return this.userService.remove(id);
  }

  @Patch('image/update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update profile image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Profile image file',
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Image updated successfully' })
  @ApiResponse({ status: 400, description: 'No image provided or invalid image' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        // Generate unique filename - same logic as register
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    })
  }))
  async updateImage(
    @CurrentUser() user: UserDocument,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    try {
      if (!image) {
        throw new BadRequestException('No image provided');
      }
      
      const imagePath = `uploads/${image.filename}`;
      return await this.userService.updateImage(user._id.toString(), imagePath);
      
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        throw new HttpException('Invalid input', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Problem au niveau serveur', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password by email' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.userService.resetPassword(resetPasswordDto);
  }
}
