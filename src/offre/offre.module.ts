// offre.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OffreController } from './offre.controller';
import { OffreService } from './offre.service';
import { Offre, OffreSchema } from './schemas/offre.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Offre.name, schema: OffreSchema }])
  ],
  controllers: [OffreController],
  providers: [OffreService],
  exports: [OffreService]
})
export class OffreModule {}