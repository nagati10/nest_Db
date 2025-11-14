import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { EvenementService } from './evenement.service';
import { CreateEvenementDto } from './dto/create-evenement.dto';
import { UpdateEvenementDto } from './dto/update-evenement.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('evenements')
@Controller('evenements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class EvenementController {
  constructor(private readonly evenementService: EvenementService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un nouvel événement' })
  @ApiResponse({ status: 201, description: 'Événement créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async create(
    @Body() createEvenementDto: CreateEvenementDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.evenementService.create(createEvenementDto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les événements de l\'utilisateur' })
  @ApiResponse({ status: 200, description: 'Liste des événements' })
  async findAll(@CurrentUser() user: any) {
    const userId = user.userId || user._id || user.id;
    return this.evenementService.findAllByUser(userId);
  }

  @Get('date-range')
  @ApiOperation({ summary: 'Récupérer les événements dans une plage de dates' })
  @ApiResponse({ status: 200, description: 'Liste des événements dans la plage' })
  async findByDateRange(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.evenementService.findByUserAndDateRange(userId, startDate, endDate);
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Récupérer les événements par type' })
  @ApiResponse({ status: 200, description: 'Liste des événements du type spécifié' })
  async findByType(
    @CurrentUser() user: any,
    @Param('type') type: string,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.evenementService.findByType(userId, type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un événement par ID' })
  @ApiResponse({ status: 200, description: 'Événement trouvé' })
  @ApiResponse({ status: 404, description: 'Événement non trouvé' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.evenementService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un événement' })
  @ApiResponse({ status: 200, description: 'Événement modifié avec succès' })
  @ApiResponse({ status: 404, description: 'Événement non trouvé' })
  async update(
    @Param('id') id: string,
    @Body() updateEvenementDto: UpdateEvenementDto,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.evenementService.update(id, updateEvenementDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un événement' })
  @ApiResponse({ status: 200, description: 'Événement supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Événement non trouvé' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const userId = user.userId || user._id || user.id;
    return this.evenementService.remove(id, userId);
  }
}