import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { AvisService } from './avis.service';
import { CreateAvisDto } from './dto/create-avi.dto';
import { UpdateAviDto } from './dto/update-avi.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('avis')
@Controller('avis')
export class AvisController {
  constructor(private readonly avisService: AvisService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un nouvel avis' })
  @ApiResponse({ status: 201, description: 'Avis créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async create(@Body() createAvisDto: CreateAvisDto) {
    return this.avisService.create(createAvisDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les avis' })
  @ApiResponse({ status: 200, description: 'Liste de tous les avis' })
  async findAll() {
    return this.avisService.findAll();
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
  @ApiOperation({ summary: 'Récupérer un avis par ID' })
  @ApiResponse({ status: 200, description: 'Avis trouvé' })
  @ApiResponse({ status: 404, description: 'Avis non trouvé' })
  async findOne(@Param('id') id: string) {
    return this.avisService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier un avis' })
  @ApiResponse({ status: 200, description: 'Avis modifié avec succès' })
  @ApiResponse({ status: 404, description: 'Avis non trouvé' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @Body() updateAviDto: UpdateAviDto,
  ) {
    return this.avisService.update(id, updateAviDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer un avis' })
  @ApiResponse({ status: 200, description: 'Avis supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Avis non trouvé' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string) {
    return this.avisService.remove(id);
  }
}