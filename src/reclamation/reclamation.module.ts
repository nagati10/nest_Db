import { Module } from '@nestjs/common';
import { ReclamationService } from './reclamation.service';
import { ReclamationController } from './reclamation.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Reclamation, ReclamationSchema } from './schemas/reclamation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Reclamation.name, schema: ReclamationSchema }])
  ],
  controllers: [ReclamationController],
  providers: [ReclamationService],
  exports: [ReclamationService]
})
export class ReclamationModule {}