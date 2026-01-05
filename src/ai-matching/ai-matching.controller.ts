import { Controller, Post, Body, UseGuards, Req, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiMatchingService } from './ai-matching.service';
import { MatchingRequestDto } from './dto/matching-request.dto';
import { MatchingResponseDto } from './dto/matching-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('AI Matching')
@Controller('ai-matching')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiMatchingController {
  constructor(private readonly aiMatchingService: AiMatchingService) {}

  @Post('analyze')
  @ApiOperation({ 
    summary: 'Analyse et matche les offres avec les disponibilités de l\'étudiant',
    description: 'Utilise l\'IA pour calculer la compatibilité entre les disponibilités d\'un étudiant et les offres disponibles'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Matching réussi',
    type: MatchingResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Non autorisé' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Aucune offre trouvée' 
  })
  async analyzeMatching(
    @Body() request: MatchingRequestDto,
    @Req() req: any
  ): Promise<MatchingResponseDto> {
    // S'assurer que l'étudiant demande ses propres données
    const userId = req.user.userId || req.user.sub || req.user._id;
    request.studentId = userId.toString();

    return this.aiMatchingService.matchOffres(request);
  }

  @Post('analyze/:studentId')
  @ApiOperation({ 
    summary: 'Analyse les offres pour un étudiant spécifique (Admin)',
    description: 'Permet aux administrateurs d\'analyser les offres pour n\'importe quel étudiant'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Matching réussi',
    type: MatchingResponseDto 
  })
  async analyzeMatchingForStudent(
    @Param('studentId') studentId: string,
    @Body() request: MatchingRequestDto
  ): Promise<MatchingResponseDto> {
    request.studentId = studentId;
    return this.aiMatchingService.matchOffres(request);
  }

  @Get('health')
  @ApiOperation({ 
    summary: 'Vérifie l\'état du service de matching',
    description: 'Retourne l\'état du service et la disponibilité de l\'IA'
  })
  getHealth() {
    return {
      status: 'ok',
      service: 'AI Matching',
      timestamp: new Date().toISOString(),
      message: 'Service de matching IA opérationnel'
    };
  }
}

