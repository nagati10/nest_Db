import { Module } from '@nestjs/common';
import { CvAiController } from './cv_ai.controller';
import { CvAiService } from './cv_ai.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [CvAiController],
  providers: [CvAiService],
  exports: [CvAiService], // Exporté pour utilisation dans d'autres modules
})
export class CvAiModule {}