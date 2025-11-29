import { Module } from '@nestjs/common';
import { CvAiController } from './cv_ai.controller';
import { CvAiService } from './cv_ai.service';

@Module({
  controllers: [CvAiController],
  providers: [CvAiService],
})
export class CvAiModule {}