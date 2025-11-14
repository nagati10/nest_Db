import { Module } from '@nestjs/common';
import { AvisService } from './avis.service';
import { AvisController } from './avis.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Avis, AvisSchema } from './schemas/avi.schemas';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Avis.name, schema: AvisSchema }])
  ],
  controllers: [AvisController],
  providers: [AvisService],
  exports: [AvisService]
})
export class AvisModule {}