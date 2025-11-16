import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OffreController } from './offre.controller';
import { OffreService } from './offre.service';
import { Offre, OffreSchema } from './schemas/offre.schema';
import { User, UserSchema } from '../User/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Offre.name, schema: OffreSchema }]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]) // Add User schema
  ],
  controllers: [OffreController],
  providers: [OffreService],
  exports: [OffreService]
})
export class OffreModule {}