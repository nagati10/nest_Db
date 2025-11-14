// offre.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  UsePipes, 
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import path from 'path';
import { OffreService } from './offre.service';
import { CreateOffreDto } from './dto/create-offre.dto';
import { UpdateOffreDto } from './dto/update-offre.dto';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('offres')
@Controller('offre')
@UsePipes(new ValidationPipe({ transform: true }))
export class OffreController {
  constructor(private readonly offreService: OffreService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new offer', description: 'Create a new job offer with optional image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Offer creation form with optional image',
    type: CreateOffreDto
  })
  @ApiResponse({ status: 201, description: 'Offer successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Server problem' })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('imageFile', {
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
      fileSize: 5 * 1024 * 1024, // 5MB limit
    }
  }))
  async create(
    @Body() createOffreDto: CreateOffreDto,
    @UploadedFile() imageFile?: Express.Multer.File,
    @CurrentUser() user?: any,
  ) {
    try {
      // Extract user ID from token
      const userId = user.userId || user._id || user.id;
      if (!userId) {
        throw new HttpException('User not found in token', HttpStatus.UNAUTHORIZED);
      }
      
      return await this.offreService.create(createOffreDto, userId, imageFile);
    } catch (error) {
      if (error.status === 400 || error.status === 401) {
        throw new HttpException(error.message, error.status);
      }
      throw new HttpException('Problem au niveau serveur', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all active offers' })
  @ApiResponse({ status: 200, description: 'List of all active offers' })
  async findAll() {
    return this.offreService.findAll();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search offers by query' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(@Query('q') query: string) {
    if (!query) {
      throw new HttpException('Query parameter is required', HttpStatus.BAD_REQUEST);
    }
    return this.offreService.searchOffres(query);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Find offers by tags' })
  @ApiResponse({ status: 200, description: 'Offers matching the tags' })
  async findByTags(@Query('tags') tags: string) {
    if (!tags) {
      throw new HttpException('Tags parameter is required', HttpStatus.BAD_REQUEST);
    }
    const tagsArray = tags.split(',').map(tag => tag.trim());
    return this.offreService.findByTags(tagsArray);
  }

  @Get('location/:city')
  @ApiOperation({ summary: 'Find offers by city' })
  @ApiResponse({ status: 200, description: 'Offers in the specified city' })
  async findByLocation(@Param('city') city: string) {
    return this.offreService.findByLocation(city);
  }

  @Get('my-offers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user offers' })
  @ApiResponse({ status: 200, description: 'Current user offers' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async findMyOffers(@CurrentUser() user: any) {
    const userId = user.userId || user._id || user.id;
    return this.offreService.findByUser(userId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Find offers by user ID' })
  @ApiResponse({ status: 200, description: 'User offers' })
  async findByUser(@Param('userId') userId: string) {
    return this.offreService.findByUser(userId);
  }

  @Get('popular')
  @ApiOperation({ summary: 'Get popular offers' })
  @ApiResponse({ status: 200, description: 'Most viewed offers' })
  async getPopularOffres(@Query('limit') limit: number = 10) {
    return this.offreService.getPopularOffres(limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get offer by ID' })
  @ApiResponse({ status: 200, description: 'Offer details' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  async findOne(@Param('id') id: string) {
    return this.offreService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update offer' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Offer update form with optional new image',
    type: UpdateOffreDto
  })
  @ApiResponse({ status: 200, description: 'Offer updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your offer' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('imageFile', {
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
      fileSize: 5 * 1024 * 1024, // 5MB limit
    }
  }))
  async update(
    @Param('id') id: string, 
    @Body() updateOffreDto: UpdateOffreDto,
    @UploadedFile() imageFile?: Express.Multer.File,
    @CurrentUser() user?: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.offreService.update(id, updateOffreDto, userId, imageFile);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete offer' })
  @ApiResponse({ status: 200, description: 'Offer deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your offer' })
  @ApiResponse({ status: 404, description: 'Offer not found' })
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    const userId = user.userId || user._id || user.id;
    return this.offreService.remove(id, userId);
  }
}