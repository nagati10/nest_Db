import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { CvAiService } from './cv_ai.service';

@Controller('cv')
export class CvAiController {
  constructor(private readonly cvService: CvAiService) {}

  @Post('analyze')
  async analyze(@Body('text') text: string) {
    if (!text || typeof text !== 'string' || text.trim().length < 30) {
      throw new BadRequestException('text too short or missing');
    }
    return this.cvService.analyze(text);
  }
}