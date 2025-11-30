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
      imageUrl: `uploads/${user.image}`,
      filename: user.image,
      username:user.nom
    };
  }

  @Get('image/:userId')
  @ApiOperation({ summary: 'Get user profile image URL by user ID' })
  @ApiResponse({ status: 200, description: 'Returns image URL' })
  @ApiResponse({ status: 404, description: 'User not found or has no profile image' })
  async getImageById(@Param('userId') userId: string) {
    const user = await this.userService.findOne(userId);
    
    if (!user.image) {
      throw new NotFoundException('User has no profile image');
    }
    
    return {
      imageUrl: `uploads/${user.image}`,
      filename: user.image,
      username:user.nom
    };
  }

  @Patch()
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
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
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update profile image' })
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
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password by email' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.userService.resetPassword(resetPasswordDto);
  }

  @Get('mode-examens')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current exam mode status' })
  @ApiResponse({ status: 200, description: 'Returns exam mode status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async getModeExamens(@CurrentUser() user: any) {
    const id = user.userId || user._id || user.id;
    const currentUser = await this.userService.findOne(id);
    
    return {
      modeExamens: currentUser.modeExamens
    };
  }

  @Patch('archive/toggle')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Toggle archive state for current user' })
  @ApiResponse({ status: 200, description: 'Archive state toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async switchArchiveState(@CurrentUser() user: any) {
    const id = user.userId || user._id || user.id;
    return this.userService.switchArchiveState(id);
  }

  @Patch('trust/level-up/:xp')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Increase trust XP' })
  @ApiResponse({ status: 200, description: 'Trust XP increased successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async levelUp(@CurrentUser() user: any, @Param('xp') xp: number) {
    const id = user.userId || user._id || user.id;
    return this.userService.levelUp(id, xp);
  }

  @Patch('trust/level-down/:xp')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Decrease trust XP' })
  @ApiResponse({ status: 200, description: 'Trust XP decreased successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async levelDown(@CurrentUser() user: any, @Param('xp') xp: number) {
    const id = user.userId || user._id || user.id;
    return this.userService.levelDown(id, xp);
  }

  @Get('trust/level')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current trust level and text' })
  @ApiResponse({ status: 200, description: 'Returns trust level information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async getTrustLevel(@CurrentUser() user: any) {
    const id = user.userId || user._id || user.id;
    return this.userService.getTrustLevel(id);
  }

  @Patch('organization/toggle')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Toggle organization status' })
  @ApiResponse({ status: 200, description: 'Organization status toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async toggleOrganization(@CurrentUser() user: any) {
    const id = user.userId || user._id || user.id;
    return this.userService.toggleOrganization(id);
  }

  @Get('liked-offres')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user liked offers' })
  @ApiResponse({ status: 200, description: 'Returns array of liked offer IDs' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async getLikedOffres(@CurrentUser() user: any) {
    const id = user.userId || user._id || user.id;
    const likedOffres = await this.userService.getLikedOffres(id);
    
    return {
      likedOffres: likedOffres.map(id => id.toString())
    };
  }

  @Post('like-offre/:offreId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add offer to liked list' })
  @ApiResponse({ status: 200, description: 'Offer added to liked list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async addLikedOffre(
    @CurrentUser() user: any,
    @Param('offreId') offreId: string
  ) {
    const id = user.userId || user._id || user.id;
    return this.userService.addLikedOffre(id, offreId);
  }

  @Delete('unlike-offre/:offreId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove offer from liked list' })
  @ApiResponse({ status: 200, description: 'Offer removed from liked list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async removeLikedOffre(
    @CurrentUser() user: any,
    @Param('offreId') offreId: string
  ) {
    const id = user.userId || user._id || user.id;
    return this.userService.removeLikedOffre(id, offreId);
  }

  @Get('is-offre-liked/:offreId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if offer is liked by current user' })
  @ApiResponse({ status: 200, description: 'Returns like status', schema: {
    properties: {
      isLiked: { type: 'boolean', example: true }
    }
  }})
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async isOffreLiked(
    @CurrentUser() user: any,
    @Param('offreId') offreId: string
  ) {
    const id = user.userId || user._id || user.id;
    const isLiked = await this.userService.isOffreLiked(id, offreId);
    
    return { isLiked };
  }

  @Get(':id/trust/level')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get trust level for any user' })
  @ApiResponse({ status: 200, description: 'Returns trust level information' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin Only' })
  @UseGuards(JwtAuthGuard)
  async getTrustLevel2(@Param('id') id: string) {
    return this.userService.getTrustLevel(id);
  }
}