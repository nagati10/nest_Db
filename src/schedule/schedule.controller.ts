import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpException,
  HttpStatus,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ScheduleService, ProcessedSchedule, Course } from './schedule.service';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('schedule')
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post('process')
  @ApiOperation({ 
    summary: 'Process PDF schedule',
    description: 'Upload a PDF schedule, extract text via OCR, and return structured JSON'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'PDF file containing schedule',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF file to process',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Schedule processed successfully',
    schema: {
      type: 'object',
      properties: {
        courses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day: { type: 'string', example: 'Monday' },
              start: { type: 'string', example: '08:00' },
              end: { type: 'string', example: '10:00' },
              subject: { type: 'string', example: 'Math' },
              classroom: { type: 'string', example: 'A23' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid PDF file' })
  @ApiResponse({ status: 500, description: 'Processing error' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        // Validate PDF file
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only PDF files are allowed'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
    }),
  )
  async processSchedule(@UploadedFile() file: Express.Multer.File): Promise<ProcessedSchedule> {
    try {
      if (!file) {
        throw new BadRequestException('No PDF file provided');
      }

      if (file.mimetype !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')) {
        throw new BadRequestException('File must be a PDF');
      }

      const result = await this.scheduleService.processSchedulePDF(file.buffer);
      
      return {
        courses: result.courses,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error.status === 400) {
        throw error;
      }
      throw new HttpException(
        `Error processing schedule: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('create-events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Create events from courses',
    description: 'Convert extracted courses to calendar events automatically'
  })
  @ApiBody({
    description: 'Courses data and optional week start date',
    schema: {
      type: 'object',
      properties: {
        courses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day: { type: 'string', example: 'Monday' },
              start: { type: 'string', example: '09:00' },
              end: { type: 'string', example: '10:30' },
              subject: { type: 'string', example: 'Math' },
              classroom: { type: 'string', example: 'A23' },
            },
          },
        },
        weekStartDate: {
          type: 'string',
          format: 'date',
          description: 'Start date of the week (YYYY-MM-DD). If not provided, uses current week Monday',
          example: '2024-12-01',
        },
      },
      required: ['courses'],
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Events created successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Events created successfully' },
        eventsCreated: { type: 'number', example: 5 },
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              titre: { type: 'string' },
              type: { type: 'string' },
              date: { type: 'string' },
              heureDebut: { type: 'string' },
              heureFin: { type: 'string' },
              lieu: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid courses data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createEventsFromCourses(
    @Body() body: { courses: Course[]; weekStartDate?: string },
    @CurrentUser() user: any,
  ) {
    try {
      if (!body.courses || !Array.isArray(body.courses) || body.courses.length === 0) {
        throw new BadRequestException('Courses array is required and must not be empty');
      }

      const userId = user.userId || user._id || user.id;
      
      // Convertir weekStartDate en Date si fournie
      let weekStartDate: Date | undefined;
      if (body.weekStartDate) {
        weekStartDate = new Date(body.weekStartDate);
        if (isNaN(weekStartDate.getTime())) {
          throw new BadRequestException('Invalid weekStartDate format. Use YYYY-MM-DD');
        }
      }

      const events = await this.scheduleService.createEvenementsFromCourses(
        body.courses,
        userId,
        weekStartDate,
      );

      return {
        message: 'Events created successfully',
        eventsCreated: events.length,
        events: events,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new HttpException(
        `Error creating events: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

