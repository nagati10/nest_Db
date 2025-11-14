import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../enums/role.enum';

export class UpdateUserDto {
@ApiProperty({ description: 'Nom du producteur', example: 'Najd' })
@IsNotEmpty()
@IsString()
nom: string;

@ApiProperty({ description: 'Email du producteur', example: 'user@example.com' })
@IsNotEmpty()
@IsEmail()
email: string;

@ApiProperty({ description: 'Contact du producteur', example: '+216 21 000 000' })
@IsNotEmpty()
@IsString()
contact: string;

@ApiProperty({ description: 'Profile image file', type: 'string', format: 'binary', required: false })
@IsOptional()
@IsString()
image?: string;


@ApiProperty({ description: 'Mode examens activé ou non', example: false, required: false })
@IsOptional()
@IsBoolean()
modeExamens?: boolean;

}