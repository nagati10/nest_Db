// src/cv_ai/cv_ai.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CvAiController } from './cv_ai.controller';
import { CvAiService } from './cv_ai.service';

@Module({
  imports: [
    ConfigModule, // Pour accéder aux variables d'environnement
  ],
  controllers: [CvAiController],
  providers: [CvAiService],
  exports: [CvAiService], // Exporter si d'autres modules ont besoin du service
})
export class CvAiModule {}