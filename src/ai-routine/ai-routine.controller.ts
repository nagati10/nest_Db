import { Controller, Post, Body, UseGuards, Request, HttpException, HttpStatus, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AIRoutineService } from './ai-routine.service';
import { AIRoutineEnhancedService } from './ai-routine-enhanced.service';
import { RoutineInputDataDto } from './dto/routine-input.dto';
import { CheckJobCompatibilityDto, QuickSuggestionDto } from './dto/job-compatibility.dto';

@ApiTags('AI Routine')
@Controller('ai/routine')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIRoutineController {
  constructor(
    private readonly aiRoutineService: AIRoutineService,
    private readonly aiRoutineEnhancedService: AIRoutineEnhancedService,
  ) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyser la routine hebdomadaire avec IA (version de base)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Analyse de routine réussie',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 500, description: 'Erreur serveur' })
  async analyzeRoutine(
    @Request() req,
    @Body() data: RoutineInputDataDto,
  ) {
    try {
      const userId = req.user?._id?.toString() || req.user?.id || req.user?.sub;
      
      if (!userId) {
        throw new HttpException(
          'Utilisateur non authentifié',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (!data.evenements || !Array.isArray(data.evenements)) {
        throw new HttpException(
          'Les événements sont requis',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!data.disponibilites || !Array.isArray(data.disponibilites)) {
        throw new HttpException(
          'Les disponibilités sont requises',
          HttpStatus.BAD_REQUEST,
        );
      }

      const analysis = await this.aiRoutineService.analyzeRoutine(userId, data);
      
      return {
        success: true,
        data: analysis,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de l\'analyse',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('analyze-enhanced')
  @ApiOperation({ 
    summary: 'Analyser la routine avec détection des conflits et optimisations (VERSION AMÉLIORÉE)',
    description: 'Version améliorée avec détection automatique des conflits d\'horaires, identification des jours surchargés, calcul des créneaux disponibles et recommandations intelligentes'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Analyse complète de routine réussie avec détection des conflits',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 500, description: 'Erreur serveur' })
  async analyzeRoutineEnhanced(
    @Request() req,
    @Body() data: RoutineInputDataDto,
  ) {
    try {
      const userId = req.user?._id?.toString() || req.user?.id || req.user?.sub;
      
      if (!userId) {
        throw new HttpException(
          'Utilisateur non authentifié',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (!data.evenements || !Array.isArray(data.evenements)) {
        throw new HttpException(
          'Les événements sont requis',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!data.disponibilites || !Array.isArray(data.disponibilites)) {
        throw new HttpException(
          'Les disponibilités sont requises',
          HttpStatus.BAD_REQUEST,
        );
      }

      const analysis = await this.aiRoutineEnhancedService.analyzeRoutineEnhanced(userId, data);
      
      return {
        success: true,
        message: 'Analyse complète effectuée avec succès',
        data: analysis,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de l\'analyse améliorée',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('check-job-compatibility')
  @ApiOperation({ 
    summary: 'Vérifier la compatibilité d\'une offre avec l\'emploi du temps',
    description: 'Analyse si l\'étudiant a suffisamment de temps disponible pour accepter une offre d\'emploi'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Analyse de compatibilité réussie',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 404, description: 'Offre non trouvée' })
  async checkJobCompatibility(
    @Request() req,
    @Body() body: { offreId: string; routineData: RoutineInputDataDto },
  ) {
    try {
      const userId = req.user?._id?.toString() || req.user?.id || req.user?.sub;
      
      if (!userId) {
        throw new HttpException(
          'Utilisateur non authentifié',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const compatibility = await this.aiRoutineEnhancedService.analyzeJobCompatibility(
        userId,
        body.offreId,
        body.routineData
      );
      
      return {
        success: true,
        data: compatibility,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de l\'analyse de compatibilité',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('quick-suggestion')
  @ApiOperation({ 
    summary: 'Obtenir une suggestion rapide lors de l\'ajout d\'un événement',
    description: 'Analyse en temps réel pour détecter les conflits potentiels avant d\'ajouter un événement'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Suggestion générée avec succès',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async getQuickSuggestion(
    @Request() req,
    @Body() body: QuickSuggestionDto,
  ) {
    try {
      const userId = req.user?._id?.toString() || req.user?.id || req.user?.sub;
      
      if (!userId) {
        throw new HttpException(
          'Utilisateur non authentifié',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const suggestion = await this.aiRoutineEnhancedService.getQuickSuggestion(
        userId,
        body.newEvent,
        body.currentEvents || []
      );
      
      return {
        success: true,
        data: suggestion,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Erreur lors de la génération de suggestion',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Vérifier l\'état du service AI Routine' })
  @ApiResponse({ 
    status: 200, 
    description: 'Service opérationnel',
  })
  async checkHealth() {
    return {
      success: true,
      service: 'AI Routine Enhanced',
      status: 'operational',
      version: '2.0',
      timestamp: new Date().toISOString(),
      features: [
        'Détection automatique des conflits d\'horaires',
        'Identification des jours surchargés',
        'Calcul des créneaux disponibles',
        'Analyse de compatibilité avec offres d\'emploi',
        'Suggestions en temps réel',
        'Recommandations personnalisées IA',
      ],
    };
  }
}

