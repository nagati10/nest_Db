import { Module } from '@nestjs/common';
import { EvenementService } from './evenement.service';
import { EvenementController } from './evenement.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Evenement, EvenementSchema } from './schemas/evenement.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Evenement.name, schema: EvenementSchema }])
  ],
  controllers: [EvenementController],
  providers: [EvenementService],
  exports: [EvenementService]
})
export class EvenementModule {}