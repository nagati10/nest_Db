// src/cv_ai/cv_ai.service.ts

import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { NEREntity, ParsedCvDto } from './cv_ai.dto';

@Injectable()
export class CvAiService {
  private readonly logger = new Logger(CvAiService.name);
  private readonly HF_API_URL = 
    'https://api-inference.huggingface.co/models/yashpwr/resume-ner-bert-v2';
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || '';
    
    if (!this.apiKey) {
      this.logger.error('❌ HUGGINGFACE_API_KEY non définie dans .env');
      throw new Error('Configuration manquante: HUGGINGFACE_API_KEY');
    }

    this.logger.log('✅ CvAiService initialisé avec succès');
  }

  /**
   * Appelle l'API Hugging Face pour extraire les entités NER
   */
  async extractEntities(cvText: string): Promise<NEREntity[]> {
    if (!cvText || cvText.trim().length === 0) {
      throw new HttpException(
        'Le texte du CV ne peut pas être vide',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(`🔍 Extraction d'entités pour un texte de ${cvText.length} caractères`);

    try {
      const response = await axios.post(
        this.HF_API_URL,
        { 
          inputs: cvText,
          options: {
            wait_for_model: true,
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      // Transformer les données de l'API Hugging Face
      const entities: NEREntity[] = response.data.map((entity: any) => ({
        label: this.cleanLabel(entity.entity_group || entity.entity),
        text: this.cleanText(entity.word),
        confidence: Math.round(entity.score * 100) / 100,
        start: entity.start,
        end: entity.end,
      }));

      this.logger.log(`✅ ${entities.length} entités extraites avec succès`);
      return entities;

    } catch (error) {
      return this.handleApiError(error);
    }
  }

  /**
   * Parse le CV et organise les données par catégorie
   */
  async parseCv(cvText: string): Promise<ParsedCvDto> {
    this.logger.log('📄 Début du parsing du CV');
    
    const entities = await this.extractEntities(cvText);
    const parsed = new ParsedCvDto();
    parsed.allEntities = entities;

    // Regrouper les entités par type
    const groupedEntities = this.groupEntitiesByLabel(entities);

    // Mapper les entités aux champs appropriés
    parsed.name = this.getFirstValue(groupedEntities, 'Name');
    parsed.email = this.getFirstValue(groupedEntities, 'Email Address');
    parsed.phone = this.getFirstValue(groupedEntities, 'Phone');
    parsed.location = this.getFirstValue(groupedEntities, 'Location');
    parsed.yearsOfExperience = this.getFirstValue(groupedEntities, 'Years of Experience');

    parsed.companies = this.getValues(groupedEntities, 'Companies worked at');
    parsed.designations = this.getValues(groupedEntities, 'Designation');
    parsed.skills = this.getValues(groupedEntities, 'Skills');
    parsed.degrees = this.getValues(groupedEntities, 'Degree');
    parsed.colleges = this.getValues(groupedEntities, 'College Name');
    parsed.graduationYears = this.getValues(groupedEntities, 'Graduation Year');

    this.logger.log('✅ Parsing du CV terminé avec succès');
    this.logParsedSummary(parsed);
    
    return parsed;
  }

  /**
   * Log un résumé des données parsées
   */
  private logParsedSummary(parsed: ParsedCvDto): void {
    this.logger.log(`📊 Résumé: ${parsed.name || 'N/A'} | ` +
      `${parsed.skills.length} compétences | ` +
      `${parsed.companies.length} entreprises | ` +
      `${parsed.degrees.length} diplômes`);
  }

  /**
   * Nettoie les labels (enlève les préfixes B- et I-)
   */
  private cleanLabel(label: string): string {
    return label.replace(/^(B-|I-)/, '');
  }

  /**
   * Nettoie le texte extrait (enlève les tokens BERT)
   */
  private cleanText(text: string): string {
    return text
      .replace(/##/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Regroupe les entités par label et fusionne les entités adjacentes
   */
  private groupEntitiesByLabel(entities: NEREntity[]): Map<string, string[]> {
    const grouped = new Map<string, string[]>();
    
    // Helper pour ajouter une entité au map
    const addEntityToMap = (label: string, text: string): void => {
      const values = grouped.get(label) || [];
      if (!values.includes(text)) {
        values.push(text);
      }
      grouped.set(label, values);
    };
    
    let currentLabel: string | null = null;
    let currentText: string | null = null;

    entities.forEach((entity, index) => {
      const shouldMerge = 
        currentLabel !== null &&
        currentText !== null &&
        currentLabel === entity.label &&
        index > 0 &&
        entities[index - 1].end === entity.start;

      if (shouldMerge) {
        // Fusionne avec l'entité courante
        currentText = currentText + ' ' + entity.text;
      } else {
        // Sauvegarde l'entité précédente si elle existe
        if (currentLabel !== null && currentText !== null) {
          addEntityToMap(currentLabel, currentText);
        }
        // Commence une nouvelle entité
        currentLabel = entity.label;
        currentText = entity.text;
      }
    });

    // Sauvegarde la dernière entité
    if (currentLabel !== null && currentText !== null) {
      addEntityToMap(currentLabel, currentText);
    }

    return grouped;
  }

  /**
   * Récupère la première valeur pour un label donné
   */
  private getFirstValue(
    grouped: Map<string, string[]>,
    label: string,
  ): string | undefined {
    const values = grouped.get(label);
    return values && values.length > 0 ? values[0] : undefined;
  }

  /**
   * Récupère toutes les valeurs pour un label donné
   */
  private getValues(grouped: Map<string, string[]>, label: string): string[] {
    return grouped.get(label) || [];
  }

  /**
   * Gère les erreurs de l'API Hugging Face
   */
  private handleApiError(error: any): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response?.status === 503) {
        this.logger.warn('⚠️  Le modèle Hugging Face est en cours de chargement');
        throw new HttpException(
          'Le modèle est en cours de chargement. Veuillez réessayer dans 20 secondes.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      
      if (axiosError.response?.status === 401) {
        this.logger.error('❌ Clé API Hugging Face invalide');
        throw new HttpException(
          'Clé API Hugging Face invalide',
          HttpStatus.UNAUTHORIZED,
        );
      }

      if (axiosError.code === 'ECONNABORTED') {
        this.logger.error('⏱️  Timeout de la requête vers Hugging Face');
        throw new HttpException(
          'Délai d\'attente dépassé. Veuillez réessayer.',
          HttpStatus.REQUEST_TIMEOUT,
        );
      }
    }

    this.logger.error(`❌ Erreur lors de l'extraction: ${error.message}`);
    throw new HttpException(
      `Erreur lors de l'extraction des entités: ${error.message}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * Valide le format d'email
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valide le format de téléphone
   */
  validatePhone(phone: string): boolean {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    const digitsOnly = phone.replace(/\D/g, '');
    return phoneRegex.test(phone) && digitsOnly.length >= 10;
  }
}