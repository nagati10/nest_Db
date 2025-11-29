// src/cv_ai/cv_ai.controller.ts

import {
  Controller,
  Post,
  Get,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { CvAiService } from './cv_ai.service';
import {
  ParseCvTextDto,
  ParsedCvDto,
  ExtractEntitiesResponseDto,
  HealthCheckResponseDto,
} from './cv_ai.dto';



// ✅ SOLUTION 1 : Utiliser require (Recommandé pour pdf-parse)
const pdfParse = require('pdf-parse');

// ✅ SOLUTION 2 : Import dynamique
//import pdfParse = require('pdf-parse');


@ApiTags('CV AI - Analyse de CV')
@Controller('cv-ai')
export class CvAiController {
  private readonly logger = new Logger(CvAiController.name);

  constructor(private readonly cvAiService: CvAiService) {
    this.logger.log('✅ CvAiController initialisé');
  }

  /**
   * POST /cv-ai/parse-text
   * Parse du texte brut de CV
   */
  @Post('parse-text')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Analyser un CV depuis du texte brut',
    description: 'Extrait et structure les informations d\'un CV à partir de texte brut (max 10000 caractères)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'CV analysé avec succès',
    type: ParsedCvDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Texte invalide ou trop long' 
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Modèle en cours de chargement' 
  })
  async parseText(@Body() body: ParseCvTextDto): Promise<ParsedCvDto> {
    this.logger.log('📥 Requête reçue: parse-text');

    if (!body.text || body.text.trim().length === 0) {
      throw new BadRequestException('Le texte du CV est requis');
    }

    if (body.text.length > 10000) {
      throw new BadRequestException(
        'Le texte est trop long (maximum 10000 caractères)',
      );
    }

    try {
      const result = await this.cvAiService.parseCv(body.text);
      this.logger.log('✅ Parsing du texte réussi');
      return result;
    } catch (error) {
      this.logger.error(`❌ Erreur lors du parsing: ${error.message}`);
      throw error;
    }
  }

  /**
   * POST /cv-ai/parse-pdf
   * Parse un fichier PDF de CV
   */
  @Post('parse-pdf')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB maximum
      },
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Seuls les fichiers PDF sont acceptés'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({ 
    summary: 'Analyser un CV depuis un fichier PDF',
    description: 'Extrait le texte d\'un PDF et analyse le CV (max 5 MB)'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Fichier PDF du CV (max 5 MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'CV PDF analysé avec succès',
    type: ParsedCvDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Fichier invalide ou PDF non extractible' 
  })
  async parsePdf(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ParsedCvDto> {
    this.logger.log('📥 Requête reçue: parse-pdf');

    if (!file) {
      throw new BadRequestException('Le fichier PDF est requis');
    }

    this.logger.log(`📄 Traitement du fichier: ${file.originalname} (${(file.size / 1024).toFixed(2)} KB)`);

    try {
      // Extraire le texte du PDF avec pdf-parse
      const pdfData = await pdfParse(file.buffer);
      const text = pdfData.text;

      if (!text || text.trim().length === 0) {
        throw new BadRequestException(
          'Le PDF ne contient pas de texte extractible. Assurez-vous que le PDF n\'est pas une image scannée.',
        );
      }

      this.logger.log(`✅ Texte extrait du PDF: ${text.length} caractères`);

      // Vérifier la longueur du texte
      if (text.length > 15000) {
        this.logger.warn(`⚠️  Texte très long (${text.length} caractères), troncature à 15000`);
        const truncatedText = text.substring(0, 15000);
        const result = await this.cvAiService.parseCv(truncatedText);
        this.logger.log('✅ Parsing du PDF réussi (texte tronqué)');
        return result;
      }

      // Parser le texte extrait
      const result = await this.cvAiService.parseCv(text);
      this.logger.log('✅ Parsing du PDF réussi');
      return result;

    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`❌ Erreur lors de la lecture du PDF: ${error.message}`);
      throw new BadRequestException(
        `Erreur lors de la lecture du PDF: ${error.message}`,
      );
    }
  }

  /**
   * POST /cv-ai/extract-entities
   * Extrait uniquement les entités NER (sans structuration)
   */
  @Post('extract-entities')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Extraire uniquement les entités NER',
    description: 'Retourne toutes les entités détectées sans les structurer'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Entités extraites avec succès',
    type: ExtractEntitiesResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Texte invalide' 
  })
  async extractEntities(
    @Body() body: ParseCvTextDto,
  ): Promise<ExtractEntitiesResponseDto> {
    this.logger.log('📥 Requête reçue: extract-entities');

    if (!body.text || body.text.trim().length === 0) {
      throw new BadRequestException('Le texte du CV est requis');
    }

    try {
      const entities = await this.cvAiService.extractEntities(body.text);
      
      this.logger.log(`✅ ${entities.length} entités extraites`);
      
      return {
        totalEntities: entities.length,
        entities: entities,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur lors de l'extraction: ${error.message}`);
      throw error;
    }
  }

  /**
   * GET /cv-ai/health
   * Vérifier si le service est opérationnel
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Vérifier le statut du service',
    description: 'Retourne le statut de santé du service CV AI'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service opérationnel',
    type: HealthCheckResponseDto 
  })
  healthCheck(): HealthCheckResponseDto {
    this.logger.log('💚 Health check demandé');
    
    return {
      status: 'ok',
      service: 'CV AI NER Service',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /cv-ai/info
   * Informations sur le modèle et les capacités
   */
  @Get('info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Informations sur le service',
    description: 'Retourne les détails du modèle, entités supportées et limites'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Informations du service' 
  })
  getInfo() {
    this.logger.log('ℹ️  Info demandée');
    
    return {
      model: 'yashpwr/resume-ner-bert-v2',
      version: 'v2',
      accuracy: '90.87% F1 Score',
      supportedLanguages: ['English'],
      entities: [
        'Name',
        'Email Address',
        'Phone',
        'Location',
        'Companies worked at',
        'Designation',
        'Skills',
        'Years of Experience',
        'Degree',
        'College Name',
        'Graduation Year',
      ],
      limits: {
        maxTextLength: 10000,
        maxPdfSize: '5 MB',
        timeout: '30 seconds',
      },
      endpoints: [
        { method: 'POST', path: '/cv-ai/parse-text', description: 'Analyser un CV depuis du texte brut' },
        { method: 'POST', path: '/cv-ai/parse-pdf', description: 'Analyser un CV depuis un PDF' },
        { method: 'POST', path: '/cv-ai/extract-entities', description: 'Extraire uniquement les entités NER' },
        { method: 'GET', path: '/cv-ai/health', description: 'Vérifier le statut du service' },
        { method: 'GET', path: '/cv-ai/info', description: 'Informations sur le service' },
      ],
      documentation: 'https://huggingface.co/yashpwr/resume-ner-bert-v2',
      examples: {
        text: 'John Doe is a Senior Software Engineer with 5 years of experience at Google. Skills: Python, JavaScript, React. Email: john@example.com Phone: +1-555-123-4567',
      },
    };
  }
}