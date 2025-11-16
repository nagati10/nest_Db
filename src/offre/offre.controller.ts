import {
  Controller,
  Post,
  Body,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpException,
  HttpStatus,
  Get,
  Patch,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { OffreService } from './offre.service';
import { CreateOffreDto } from './dto/create-offre.dto';
import { UpdateOffreDto } from './dto/update-offre.dto';
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
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';

@ApiTags('offres')
@Controller('offre')
@UsePipes(new ValidationPipe({ transform: true }))
export class OffreController {
  constructor(private readonly offreService: OffreService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Create new offer', 
    description: 'Create a new job offer with optional images' 
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Offer creation form with optional images',
    type: CreateOffreDto
  })
  @ApiResponse({ status: 201, description: 'Offer successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Server problem' })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('imageFiles', 10, {
    storage: diskStorage({
      destination: './uploads/offres',
      filename: (req, file, cb) => {
        const uniqueName = `offre-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    }),
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    }
  }))
  async create(
    @Body() createOffreDto: CreateOffreDto,
    @UploadedFiles() imageFiles?: Express.Multer.File[],
    @CurrentUser() user?: any,
  ) {
    try {
      // The CurrentUser decorator should provide the full user object from the token
      if (!user) {
        throw new HttpException('User not found in token', HttpStatus.UNAUTHORIZED);
      }

      // Use the user object directly from the token
      return await this.offreService.create(createOffreDto, user, imageFiles);
    } catch (error) {
      if (error.status === 400 || error.status === 401) {
        throw new HttpException(error.message, error.status);
      }
      throw new HttpException('Problem au niveau serveur', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all active offers' })
  @ApiResponse({ status: 200, description: 'Returns all active offers' })
  async findAll() {
    return this.offreService.findAllActive();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search offers by query' })
  @ApiResponse({ status: 200, description: 'Returns matching offers' })
  async search(@Query('q') query: string) {
    return this.offreService.searchOffers(query);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Find offers by tags' })
  @ApiResponse({ status: 200, description: 'Returns offers with matching tags' })
  async findByTags(@Query('tags') tags: string) {
    const tagArray = tags.split(',').map(tag => tag.trim());
    return this.offreService.findByTags(tagArray);
  }

  @Get('location/:city')
  @ApiOperation({ summary: 'Find offers by city' })
  @ApiResponse({ status: 200, description: 'Returns offers in the specified city' })
  async findByCity(@Param('city') city: string) {
    return this.offreService.findByCity(city);
  }

  @Get('my-offers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user offers' })
  @ApiResponse({ status: 200, description: 'Returns current user offers' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async findMyOffers(@CurrentUser() user: any) {
    return this.offreService.findByUser(user);
  }

  @Get('liked')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get offers liked by current user' })
  @ApiResponse({ status: 200, description: 'Returns liked offers' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async findLikedOffers(@CurrentUser() user: any) {
    return this.offreService.findLikedOffers(user);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Find offers by user ID' })
  @ApiResponse({ status: 200, description: 'Returns user offers' })
  async findByUserId(@Param('userId') userId: string) {
    return this.offreService.findByUserId(userId);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular offers' })
  @ApiResponse({ status: 200, description: 'Returns popular offers' })
  async findPopular() {
    return this.offreService.findPopular();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get offer by ID' })
  @ApiResponse({ status: 200, description: 'Returns the offer' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async findOne(@Param('id') id: string) {
    return this.offreService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update offer' })
  @ApiResponse({ status: 200, description: 'Offer updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateOffreDto: UpdateOffreDto,
    @CurrentUser() user: any,
  ) {
    return this.offreService.update(id, updateOffreDto, user);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete offer' })
  @ApiResponse({ status: 200, description: 'Offer deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.offreService.remove(id, user);
  }

  @Post(':id/like')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like or unlike an offer' })
  @ApiResponse({ status: 200, description: 'Like status updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async likeOffer(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.offreService.toggleLike(id, user);
  }
}