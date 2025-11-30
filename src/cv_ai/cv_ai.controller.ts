import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CvAiService } from './cv_ai.service';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';

// ------- DTOs Swagger -------

class AnalyzeDocumentDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Fichier à analyser (PDF, JPG, PNG)',
    required: true,
  })
  file: any;

  @ApiProperty({
    description: 'Nombre maximum de pages à traiter (1-9)',
    example: 2,
    required: false,
    default: 2,
    minimum: 1,
    maximum: 9,
  })
  maxPages?: number;
}

class ExtractCvDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Fichier CV à analyser (PDF, JPG, PNG)',
    required: true,
  })
  file: any;
}

class ImageGalleryItem {
  @ApiProperty({ example: 'https://example.com/image1.jpg' })
  url: string;
}

class DocumentAnalysisResponseDto {
  @ApiProperty({ type: [ImageGalleryItem], description: 'Images de sortie' })
  images: any[];

  @ApiProperty({
    example: 'Texte extrait du document...',
    description: 'Texte continu extrait',
  })
  contiguousText: string;

  @ApiProperty({
    example: 'Section 1: Header\nSection 2: Body...',
    description: 'Sections de layout détectées',
  })
  layoutSections: string;

  @ApiProperty({
    example: '<table><tr><td>Data</td></tr></table>',
    description: 'Tables extraites en HTML',
  })
  tablesHtml: string;

  @ApiProperty({ example: true })
  success: boolean;
}

class StructuredCvDataDto {
  @ApiProperty({ example: 'Jean Dupont', nullable: true })
  name: string | null;

  @ApiProperty({ example: 'jean.dupont@email.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: '+33 6 12 34 56 78', nullable: true })
  phone: string | null;

  @ApiProperty({
    example: ['Développeur Senior chez ABC', 'Dev Junior chez XYZ'],
  })
  experience: string[];

  @ApiProperty({
    example: ['Master en Informatique', 'Licence en Math'],
  })
  education: string[];

  @ApiProperty({
    example: ['JavaScript', 'TypeScript', 'Python', 'React'],
  })
  skills: string[];
}

@ApiTags('CV AI - Analyse de Documents')
@Controller('cv-ai')
export class CvAiController {
  constructor(private readonly cvAiService: CvAiService) {}

  // ---------- /cv-ai/analyze ----------

  @Post('analyze')
  @ApiOperation({
    summary: 'Analyser un document',
    description:
      'Analyse un document (image ou PDF) et extrait le texte, les layouts et les tables. Supporte JPG, PNG et PDF. Maximum 9 pages pour les PDFs.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Document à analyser',
    type: AnalyzeDocumentDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Document analysé avec succès',
    type: DocumentAnalysisResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Fichier manquant ou format non supporté',
    schema: {
      example: {
        statusCode: 400,
        message: 'Format de fichier non supporté. Utilisez JPG, PNG ou PDF',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: "Erreur lors de l'analyse",
  })
  @UseInterceptors(FileInterceptor('file'))
  async analyzeDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('maxPages') maxPages?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/pdf',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Format de fichier non supporté. Utilisez JPG, PNG ou PDF',
      );
    }

    const pages = maxPages ? parseInt(maxPages, 10) : 2;
    if (pages < 1 || pages > 9) {
      throw new BadRequestException('maxPages doit être entre 1 et 9');
    }

    return await this.cvAiService.analyzeDocument(file, pages);
  }

  // ---------- /cv-ai/extract-cv ----------

  @Post('extract-cv')
  @ApiOperation({
    summary: "Extraire les données d'un CV",
    description:
      'Retourne uniquement les informations structurées : nom, email, téléphone, expériences, formation et compétences.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Fichier CV à analyser',
    type: ExtractCvDto,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'CV extrait avec succès',
    type: StructuredCvDataDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Fichier manquant ou format non supporté',
    schema: {
      example: {
        statusCode: 400,
        message: 'Aucun fichier fourni',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: "Erreur lors de l'extraction",
  })
  @UseInterceptors(FileInterceptor('file'))
  async extractCvData(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/pdf',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Format de fichier non supporté. Utilisez JPG, PNG ou PDF',
      );
    }

    // 👉 ne renvoie que { name, email, phone, experience, education, skills }
    return await this.cvAiService.extractCvData(file);
  }

  // ---------- /cv-ai/health-check ----------

  @Post('health-check')
  @ApiOperation({
    summary: "Vérifier l'état du service",
    description: 'Endpoint simple pour vérifier que le service CV AI est opérationnel',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service opérationnel',
    schema: {
      example: {
        status: 'ok',
        message: 'CV AI Service is running',
        timestamp: '2024-01-15T10:30:00.000Z',
      },
    },
  })
  async healthCheck() {
    return {
      status: 'ok',
      message: 'CV AI Service is running',
      timestamp: new Date().toISOString(),
    };
  }
}
