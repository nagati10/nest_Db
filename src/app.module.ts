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
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
    }),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}