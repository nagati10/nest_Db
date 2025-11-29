// src/cv_ai/cv_ai.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

/**
 * DTO pour la requête de parsing de texte de CV
 */
export class ParseCvTextDto {
  @ApiProperty({
    description: 'Texte du CV à analyser',
    example: 'John Doe is a Senior Software Engineer with 5 years of experience at Google. Skills: Python, JavaScript, React. Email: john@example.com',
    maxLength: 10000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Le texte du CV est requis' })
  @MaxLength(10000, { message: 'Le texte ne peut pas dépasser 10000 caractères' })
  text: string;
}

/**
 * Entité NER extraite du CV
 */
export class NEREntity {
  @ApiProperty({ description: 'Type d\'entité', example: 'Name' })
  label: string;

  @ApiProperty({ description: 'Texte extrait', example: 'John Doe' })
  text: string;

  @ApiProperty({ description: 'Niveau de confiance (0-1)', example: 0.98 })
  confidence: number;

  @ApiProperty({ description: 'Position de début dans le texte', example: 0 })
  start: number;

  @ApiProperty({ description: 'Position de fin dans le texte', example: 8 })
  end: number;
}

/**
 * DTO de réponse avec les données structurées du CV
 */
export class ParsedCvDto {
  @ApiProperty({ description: 'Nom complet', example: 'John Doe', required: false })
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Adresse email', example: 'john@example.com', required: false })
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Numéro de téléphone', example: '+1-555-123-4567', required: false })
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'Localisation', example: 'San Francisco, CA', required: false })
  @IsOptional()
  location?: string;

  @ApiProperty({ 
    description: 'Liste des entreprises', 
    example: ['Google', 'Microsoft'], 
    type: [String] 
  })
  companies: string[];

  @ApiProperty({ 
    description: 'Liste des postes occupés', 
    example: ['Senior Software Engineer', 'Tech Lead'], 
    type: [String] 
  })
  designations: string[];

  @ApiProperty({ 
    description: 'Liste des compétences', 
    example: ['Python', 'JavaScript', 'React'], 
    type: [String] 
  })
  skills: string[];

  @ApiProperty({ 
    description: 'Liste des diplômes', 
    example: ['Bachelor of Computer Science'], 
    type: [String] 
  })
  degrees: string[];

  @ApiProperty({ 
    description: 'Liste des établissements', 
    example: ['Stanford University'], 
    type: [String] 
  })
  colleges: string[];

  @ApiProperty({ 
    description: 'Années de graduation', 
    example: ['2020'], 
    type: [String] 
  })
  graduationYears: string[];

  @ApiProperty({ 
    description: 'Années d\'expérience', 
    example: '5 years', 
    required: false 
  })
  @IsOptional()
  yearsOfExperience?: string;

  @ApiProperty({ 
    description: 'Toutes les entités extraites', 
    type: [NEREntity] 
  })
  allEntities: NEREntity[];

  constructor() {
    this.companies = [];
    this.designations = [];
    this.skills = [];
    this.degrees = [];
    this.colleges = [];
    this.graduationYears = [];
    this.allEntities = [];
  }
}

/**
 * DTO de réponse pour l'extraction d'entités uniquement
 */
export class ExtractEntitiesResponseDto {
  @ApiProperty({ description: 'Nombre total d\'entités trouvées', example: 15 })
  totalEntities: number;

  @ApiProperty({ description: 'Liste des entités extraites', type: [NEREntity] })
  entities: NEREntity[];
}

/**
 * DTO de réponse pour le health check
 */
export class HealthCheckResponseDto {
  @ApiProperty({ description: 'Statut du service', example: 'ok' })
  status: string;

  @ApiProperty({ description: 'Nom du service', example: 'CV AI NER Service' })
  service: string;

  @ApiProperty({ description: 'Timestamp', example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;
}