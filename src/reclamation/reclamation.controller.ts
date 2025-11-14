import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ReclamationService } from './reclamation.service';
import { CreateReclamationDto } from './dto/create-reclamation.dto';
import { UpdateReclamationDto } from './dto/update-reclamation.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReclamationType } from './schemas/reclamation.schema';

@ApiTags('reclamations')
@Controller('reclamations')
export class ReclamationController {
  constructor(private readonly reclamationService: ReclamationService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer une nouvelle réclamation' })
  @ApiResponse({ status: 201, description: 'Réclamation créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createReclamationDto: CreateReclamationDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.reclamationService.create(createReclamationDto, userId);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer toutes les réclamations (Admin seulement)' })
  @ApiResponse({ status: 200, description: 'Liste de toutes les réclamations' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async findAll() {
    return this.reclamationService.findAll();
  }

  @Get('my-reclamations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer les réclamations de l\'utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Liste des réclamations de l\'utilisateur' })
  @UseGuards(JwtAuthGuard)
  async findByUser(@CurrentUser() user: any) {
    const userId = user.userId || user._id || user.id;
    return this.reclamationService.findByUser(userId);
  }

  @Get('type/:type')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer les réclamations par type' })
  @ApiResponse({ status: 200, description: 'Liste des réclamations du type spécifié' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async findByType(@Param('type') type: ReclamationType) {
    return this.reclamationService.findByType(type);
  }

  @Get('stats/types')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir les statistiques par type de réclamation' })
  @ApiResponse({ status: 200, description: 'Statistiques par type' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getTypeStats() {
    return this.reclamationService.getStats();
  }

  @Get('stats/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir les statistiques par statut de réclamation' })
  @ApiResponse({ status: 200, description: 'Statistiques par statut' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async getStatusStats() {
    return this.reclamationService.getStatusStats();
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer une réclamation par ID' })
  @ApiResponse({ status: 200, description: 'Réclamation trouvée' })
  @ApiResponse({ status: 404, description: 'Réclamation non trouvée' })
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.reclamationService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier une réclamation' })
  @ApiResponse({ status: 200, description: 'Réclamation modifiée avec succès' })
  @ApiResponse({ status: 404, description: 'Réclamation non trouvée' })
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateReclamationDto: UpdateReclamationDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.reclamationService.update(id, updateReclamationDto, userId);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier le statut d\'une réclamation' })
  @ApiQuery({ name: 'status', required: true, description: 'Nouveau statut', example: 'résolu' })
  @ApiResponse({ status: 200, description: 'Statut modifié avec succès' })
  @ApiResponse({ status: 404, description: 'Réclamation non trouvée' })
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Query('status') status: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.reclamationService.updateStatus(id, status, userId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer une réclamation' })
  @ApiResponse({ status: 200, description: 'Réclamation supprimée avec succès' })
  @ApiResponse({ status: 404, description: 'Réclamation non trouvée' })
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.reclamationService.remove(id, userId);
  }
}