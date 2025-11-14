import { PartialType } from '@nestjs/swagger';
import { CreateAvisDto } from './create-avi.dto';

export class UpdateAviDto extends PartialType(CreateAvisDto) {}
