import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { AvisService } from './avis.service';
import { CreateAvisDto } from './dto/create-avi.dto';
import { UpdateAviDto } from './dto/update-avi.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('avis')
@Controller('avis')
export class AvisController {
  constructor(private readonly avisService: AvisService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un nouvel avis' })
  @ApiResponse({ status: 201, description: 'Avis créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createAvisDto: CreateAvisDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.avisService.create(createAvisDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les avis' })
  @ApiResponse({ status: 200, description: 'Liste de tous les avis' })
  async findAll() {
    return this.avisService.findAll();
  }

  @Get('my-avis')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer les avis de l\'utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Liste des avis de l\'utilisateur' })
  @UseGuards(JwtAuthGuard)
  async findByUser(@CurrentUser() user: any) {
    const userId = user.userId || user._id || user.id;
    return this.avisService.findAllByUser(userId);
  }

  @Get('rating')
  @ApiOperation({ summary: 'Récupérer les avis par rating' })
  @ApiQuery({ name: 'min', required: true, description: 'Rating minimum', example: 4 })
  @ApiQuery({ name: 'max', required: false, description: 'Rating maximum', example: 5 })
  @ApiResponse({ status: 200, description: 'Liste des avis filtrés par rating' })
  async findByRating(
    @Query('min') minRating: number,
    @Query('max') maxRating?: number,
  ) {
    return this.avisService.findByRating(Number(minRating), maxRating ? Number(maxRating) : undefined);
  }

  @Get('my-avis/rating')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer les avis de l\'utilisateur par rating' })
  @ApiQuery({ name: 'min', required: true, description: 'Rating minimum', example: 4 })
  @ApiQuery({ name: 'max', required: false, description: 'Rating maximum', example: 5 })
  @ApiResponse({ status: 200, description: 'Liste des avis de l\'utilisateur filtrés par rating' })
  @UseGuards(JwtAuthGuard)
  async findByUserRating(
    @CurrentUser() user: any,
    @Query('min') minRating: number,
    @Query('max') maxRating?: number,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.avisService.findByUserRating(userId, Number(minRating), maxRating ? Number(maxRating) : undefined);
  }

  @Get('anonymes')
  @ApiOperation({ summary: 'Récupérer les avis anonymes ou non' })
  @ApiQuery({ name: 'isAnonyme', required: false, description: 'Filtrer par avis anonymes', example: true })
  @ApiResponse({ status: 200, description: 'Liste des avis anonymes ou non' })
  async findAnonymes(@Query('isAnonyme') isAnonyme?: boolean) {
    return this.avisService.findAnonymes(isAnonyme !== undefined ? Boolean(isAnonyme) : true);
  }

  @Get('stats/average')
  @ApiOperation({ summary: 'Obtenir la moyenne des ratings' })
  @ApiResponse({ status: 200, description: 'Moyenne et nombre total d\'avis' })
  async getAverageRating() {
    return this.avisService.getAverageRating();
  }

  @Get('stats/distribution')
  @ApiOperation({ summary: 'Obtenir la distribution des ratings' })
  @ApiResponse({ status: 200, description: 'Distribution des ratings par étoile' })
  async getRatingDistribution() {
    return this.avisService.getRatingDistribution();
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer un avis par ID' })
  @ApiResponse({ status: 200, description: 'Avis trouvé' })
  @ApiResponse({ status: 404, description: 'Avis non trouvé' })
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.avisService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier un avis' })
  @ApiResponse({ status: 200, description: 'Avis modifié avec succès' })
  @ApiResponse({ status: 404, description: 'Avis non trouvé' })
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateAviDto: UpdateAviDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.avisService.update(id, updateAviDto, userId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un avis' })
  @ApiResponse({ status: 200, description: 'Avis supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Avis non trouvé' })
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.avisService.remove(id, userId);
  }
}