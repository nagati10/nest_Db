import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AiMatchingController } from './ai-matching.controller';
import { AiMatchingService } from './ai-matching.service';
import { Offre, OffreSchema } from '../offre/schemas/offre.schema';
import { StudentPreference, StudentPreferenceSchema } from '../student_preference/schemas/student_preference.schema';
import { Disponibilite, DisponibiliteSchema } from '../disponibilite/schemas/disponibilite.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Offre.name, schema: OffreSchema },
      { name: StudentPreference.name, schema: StudentPreferenceSchema },
      { name: Disponibilite.name, schema: DisponibiliteSchema },
    ]),
  ],
  controllers: [AiMatchingController],
  providers: [AiMatchingService],
  exports: [AiMatchingService],
})
export class AiMatchingModule {}

