import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JourSemaine } from '../schemas/disponibilite.schema';

export class CreateDisponibiliteDto {
  @ApiProperty({ description: 'Jour de la semaine', enum: JourSemaine, example: JourSemaine.LUNDI })
  @IsNotEmpty()
  @IsEnum(JourSemaine)
  jour: JourSemaine;

  @ApiProperty({ description: 'Heure de début', example: '09:00' })
  @IsNotEmpty()
  @IsString()
  heureDebut: string;

  @ApiProperty({ description: 'Heure de fin', example: '17:00', required: false })
  @IsOptional()
  @IsString()
  heureFin?: string;
}