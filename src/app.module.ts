import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './User/user.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { OffreModule } from './offre/offre.module';
import { AvisModule } from './avis/avis.module';
import { EvenementModule } from './evenement/evenement.module';
import { DisponibiliteModule } from './disponibilite/disponibilite.module';
import { ReclamationModule } from './reclamation/reclamation.module';
import { StudentPreferenceModule } from './student_preference/student_preference.module';
import { ChatModule } from './chat/chat.module';
import { CallServerModule } from './call-server/call-server.module';
import { CvAiModule } from './cv_ai/cv_ai.module';
import { AIRoutineModule } from './ai-routine/ai-routine.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AiMatchingModule } from './ai-matching/ai-matching.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
        '.env.local',
        '.env',
      ].filter(Boolean),
      // Permet de charger les variables même si le fichier n'existe pas
      ignoreEnvFile: false,
    }),
    CvAiModule,
    CallServerModule,
    AuthModule,
    UserModule,
    DatabaseModule,
    OffreModule,
    AvisModule,
    EvenementModule,
    DisponibiliteModule,
    ReclamationModule,
    StudentPreferenceModule,
    ChatModule,
    AIRoutineModule,
    ScheduleModule,
    AiMatchingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}