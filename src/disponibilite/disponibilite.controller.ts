import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { DisponibiliteService } from './disponibilite.service';
import { CreateDisponibiliteDto } from './dto/create-disponibilite.dto';
import { UpdateDisponibiliteDto } from './dto/update-disponibilite.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JourSemaine } from './schemas/disponibilite.schema';

@ApiTags('disponibilites')
@Controller('disponibilites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class DisponibiliteController {
  constructor(private readonly disponibiliteService: DisponibiliteService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle disponibilité' })
  @ApiResponse({ status: 201, description: 'Disponibilité créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async create(
    @Body() createDisponibiliteDto: CreateDisponibiliteDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.disponibiliteService.create(createDisponibiliteDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les disponibilités de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Liste des disponibilités' })
  async findAll(@CurrentUser() user: any) {
    const userId = user.userId || user._id || user.id;
    return this.disponibiliteService.findAllByUser(userId);
  }

  @Get('jour/:jour')
  @ApiOperation({ summary: 'Récupérer les disponibilités par jour' })
  @ApiResponse({ status: 200, description: 'Liste des disponibilités pour le jour spécifié' })
  async findByJour(
    @CurrentUser() user: any,
    @Param('jour') jour: JourSemaine,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.disponibiliteService.findByJour(userId, jour);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une disponibilité par ID' })
  @ApiResponse({ status: 200, description: 'Disponibilité trouvée' })
  @ApiResponse({ status: 404, description: 'Disponibilité non trouvée' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.disponibiliteService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une disponibilité' })
  @ApiResponse({ status: 200, description: 'Disponibilité modifiée avec succès' })
  @ApiResponse({ status: 404, description: 'Disponibilité non trouvée' })
  async update(
    @Param('id') id: string,
    @Body() updateDisponibiliteDto: UpdateDisponibiliteDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.disponibiliteService.update(id, updateDisponibiliteDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une disponibilité' })
  @ApiResponse({ status: 200, description: 'Disponibilité supprimée avec succès' })
  @ApiResponse({ status: 404, description: 'Disponibilité non trouvée' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.disponibiliteService.remove(id, userId);
  }

  @Delete()
  @ApiOperation({ summary: 'Supprimer toutes les disponibilités de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Toutes les disponibilités supprimées' })
  async removeAll(@CurrentUser() user: any) {
    const userId = user.userId || user._id || user.id;
    return this.disponibiliteService.removeAllByUser(userId);
  }
}