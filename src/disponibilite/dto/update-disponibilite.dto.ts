import { PartialType } from '@nestjs/swagger';
import { CreateDisponibiliteDto } from './create-disponibilite.dto';

export class UpdateDisponibiliteDto extends PartialType(CreateDisponibiliteDto) {}