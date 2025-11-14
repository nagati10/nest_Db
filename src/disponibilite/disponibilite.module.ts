import { Module } from '@nestjs/common';
import { DisponibiliteService } from './disponibilite.service';
import { DisponibiliteController } from './disponibilite.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Disponibilite, DisponibiliteSchema } from './schemas/disponibilite.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Disponibilite.name, schema: DisponibiliteSchema }])
  ],
  controllers: [DisponibiliteController],
  providers: [DisponibiliteService],
  exports: [DisponibiliteService]
})
export class DisponibiliteModule {}