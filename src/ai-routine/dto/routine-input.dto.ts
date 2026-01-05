import { IsArray, IsString, IsOptional, IsDateString, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EvenementDto {
  @ApiProperty({ description: 'ID de l\'événement', example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Titre de l\'événement', example: 'Cours Math' })
  @IsString()
  @IsNotEmpty()
  titre: string;

  @ApiProperty({ description: 'Type d\'événement', example: 'cours' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Date de l\'événement', example: '2024-01-15' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ description: 'Heure de début', example: '09:00' })
  @IsString()
  @IsNotEmpty()
  heureDebut: string;

  @ApiProperty({ description: 'Heure de fin', example: '10:30' })
  @IsString()
  @IsNotEmpty()
  heureFin: string;

  @ApiProperty({ description: 'Lieu', example: 'Room 204', required: false })
  @IsOptional()
  @IsString()
  lieu?: string;

  @ApiProperty({ description: 'Tarif horaire', example: 20.5, required: false })
  @IsOptional()
  tarifHoraire?: number;

  @ApiProperty({ description: 'Couleur', example: '#FF5733', required: false })
  @IsOptional()
  @IsString()
  couleur?: string;
}

export class DisponibiliteDto {
  @ApiProperty({ description: 'ID de la disponibilité', example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Jour de la semaine', example: 'Lundi' })
  @IsString()
  @IsNotEmpty()
  jour: string;

  @ApiProperty({ description: 'Heure de début', example: '09:00' })
  @IsString()
  @IsNotEmpty()
  heureDebut: string;

  @ApiProperty({ description: 'Heure de fin', example: '17:00', required: false })
  @IsOptional()
  @IsString()
  heureFin?: string;
}

export class UserPreferencesDto {
  @ApiProperty({ description: 'Niveau d\'éducation', example: 'Licence 1', required: false })
  @IsOptional()
  @IsString()
  educationLevel?: string;

  @ApiProperty({ description: 'Domaine d\'étude', example: 'Informatique', required: false })
  @IsOptional()
  @IsString()
  studyField?: string;

  @ApiProperty({ description: 'Types de recherche', example: ['job', 'cours'], required: false })
  @IsOptional()
  @IsArray()
  searchTypes?: string[];

  @ApiProperty({ description: 'Motivation principale', example: 'Expérience', required: false })
  @IsOptional()
  @IsString()
  mainMotivation?: string;

  @ApiProperty({ description: 'Compétences douces', example: ['Communication', 'Organisation'], required: false })
  @IsOptional()
  @IsArray()
  softSkills?: string[];

  @ApiProperty({ description: 'Niveaux de langue', example: [], required: false })
  @IsOptional()
  languageLevels?: any[];

  @ApiProperty({ description: 'Centres d\'intérêt', example: ['Sport', 'Musique'], required: false })
  @IsOptional()
  @IsArray()
  interests?: string[];
}

export class RoutineInputDataDto {
  @ApiProperty({ description: 'Liste des événements', type: [EvenementDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvenementDto)
  evenements: EvenementDto[];

  @ApiProperty({ description: 'Liste des disponibilités', type: [DisponibiliteDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DisponibiliteDto)
  disponibilites: DisponibiliteDto[];

  @ApiProperty({ description: 'Préférences utilisateur', type: UserPreferencesDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserPreferencesDto)
  preferences?: UserPreferencesDto;

  @ApiProperty({ description: 'Date de début de la période', example: '2024-01-15' })
  @IsDateString()
  @IsNotEmpty()
  dateDebut: string;

  @ApiProperty({ description: 'Date de fin de la période', example: '2024-01-22' })
  @IsDateString()
  @IsNotEmpty()
  dateFin: string;
}

