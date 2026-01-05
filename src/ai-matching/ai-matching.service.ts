import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HfInference } from '@huggingface/inference';
import { Offre, OffreDocument } from '../offre/schemas/offre.schema';
import { StudentPreference, StudentPreferenceDocument } from '../student_preference/schemas/student_preference.schema';
import { Disponibilite, DisponibiliteDocument } from '../disponibilite/schemas/disponibilite.schema';
import { MatchingRequestDto } from './dto/matching-request.dto';
import { MatchingResponseDto, OffreMatchDto, MatchingScoreDto, MatchingReasonDto } from './dto/matching-response.dto';

@Injectable()
export class AiMatchingService {
  private readonly logger = new Logger(AiMatchingService.name);
  private hf: HfInference | null = null;

  constructor(
    private configService: ConfigService,
    @InjectModel(Offre.name) private offreModel: Model<OffreDocument>,
    @InjectModel(StudentPreference.name) private studentPreferenceModel: Model<StudentPreferenceDocument>,
    @InjectModel(Disponibilite.name) private disponibiliteModel: Model<DisponibiliteDocument>,
  ) {
    this.initializeHuggingFace();
  }

  private initializeHuggingFace(): void {
    const hfApiKey = this.configService.get<string>('HF_API_KEY');
    
    if (!hfApiKey) {
      this.logger.warn('HF_API_KEY non définie - Le matching utilisera uniquement les algorithmes locaux');
      return;
    }

    try {
      this.hf = new HfInference(hfApiKey);
      this.logger.log('✅ Hugging Face initialisé avec succès');
    } catch (error) {
      this.logger.error('❌ Erreur lors de l\'initialisation de Hugging Face:', error);
    }
  }

  /**
   * Analyse et matche les disponibilités d'un étudiant avec les offres
   */
  async matchOffres(request: MatchingRequestDto): Promise<MatchingResponseDto> {
    this.logger.log(`🔍 Démarrage du matching pour l'étudiant ${request.studentId}`);

    // 1. Récupérer les préférences de l'étudiant
    const studentPreference = await this.studentPreferenceModel
      .findOne({ userId: request.studentId })
      .exec();

    // 2. Récupérer les offres à analyser
    let offres: OffreDocument[];
    if (request.offreIds && request.offreIds.length > 0) {
      offres = await this.offreModel
        .find({ 
          _id: { $in: request.offreIds },
          isActive: true 
        })
        .populate('createdBy', 'nom email company is_Organization')
        .exec();
    } else {
      offres = await this.offreModel
        .find({ isActive: true })
        .populate('createdBy', 'nom email company is_Organization')
        .limit(50) // Limiter pour la performance
        .exec();
    }

    if (offres.length === 0) {
      throw new NotFoundException('Aucune offre active trouvée');
    }

    this.logger.log(`📊 Analyse de ${offres.length} offres`);

    // 3. Calculer les scores pour chaque offre
    const matches: OffreMatchDto[] = [];
    
    for (const offre of offres) {
      const matchData = await this.calculateMatch(
        offre,
        request.disponibilites,
        studentPreference,
        request.preferences
      );
      
      if (matchData) {
        matches.push(matchData);
      }
    }

    // 4. Trier par score décroissant
    matches.sort((a, b) => b.scores.score - a.scores.score);

    // 5. Ajouter les rangs
    matches.forEach((match, index) => {
      match.rank = index + 1;
    });

    // 6. Calculer le résumé
    const scores = matches.map(m => m.scores.score);
    const averageScore = scores.length > 0 
      ? scores.reduce((a, b) => a + b, 0) / scores.length 
      : 0;

    const summary = {
      bestMatch: matches.length > 0 ? matches[0] : undefined,
      averageScore: Math.round(averageScore),
      highScoreCount: matches.filter(m => m.scores.score > 70).length,
      mediumScoreCount: matches.filter(m => m.scores.score >= 40 && m.scores.score <= 70).length,
      lowScoreCount: matches.filter(m => m.scores.score < 40).length,
    };

    this.logger.log(`✅ Matching terminé: ${matches.length} offres analysées, score moyen: ${summary.averageScore}`);

    return {
      studentId: request.studentId,
      totalOffres: offres.length,
      matches: matches.slice(0, 20), // Retourner top 20
      timestamp: new Date().toISOString(),
      summary,
    };
  }

  /**
   * Calcule le score de matching pour une offre
   */
  private async calculateMatch(
    offre: OffreDocument,
    disponibilites: any[],
    studentPreference: StudentPreferenceDocument | null,
    preferences?: any
  ): Promise<OffreMatchDto | null> {
    try {
      // 1. Score de disponibilité temporelle (40% du score total)
      const timeScore = this.calculateTimeCompatibility(offre, disponibilites);

      // 2. Score de préférences (30% du score total)
      const preferenceScore = this.calculatePreferenceScore(offre, preferences);

      // 3. Score de profil étudiant (30% du score total)
      const profileScore = this.calculateProfileScore(offre, studentPreference);

      // 4. Score global pondéré
      const globalScore = Math.round(
        timeScore * 0.4 + 
        preferenceScore * 0.3 + 
        profileScore * 0.3
      );

      // 5. Générer les raisons
      const reasons = this.generateReasons(
        offre,
        timeScore,
        preferenceScore,
        profileScore,
        disponibilites
      );

      // 6. Générer la recommandation avec IA (si disponible)
      const recommendation = await this.generateAIRecommendation(
        offre,
        globalScore,
        reasons,
        studentPreference
      );

      return {
        offreId: offre._id.toString(),
        titre: offre.title,
        entreprise: offre.company,
        ville: offre.location?.city || 'Non spécifié',
        jobType: offre.jobType,
        horaire: this.extractHoraire(offre),
        scores: {
          score: globalScore,
          timeScore: Math.round(timeScore),
          preferenceScore: Math.round(preferenceScore),
          profileScore: Math.round(profileScore),
        },
        reasons,
        recommendation,
        rank: 0, // Sera défini après le tri
      };
    } catch (error) {
      this.logger.error(`Erreur lors du calcul du match pour l'offre ${offre._id}:`, error);
      return null;
    }
  }

  /**
   * Calcule la compatibilité temporelle
   */
  private calculateTimeCompatibility(offre: OffreDocument, disponibilites: any[]): number {
    let score = 50; // Score de base

    // Analyser le shift (jour/nuit/flexible)
    if (offre.shift === 'flexible') {
      score += 30; // Très compatible
    } else if (offre.shift === 'jour') {
      // Vérifier si l'étudiant a des disponibilités en journée
      const hasJourDispos = disponibilites.some(d => {
        const heureDebut = parseInt(d.heureDebut.split(':')[0]);
        return heureDebut >= 8 && heureDebut <= 18;
      });
      score += hasJourDispos ? 20 : -10;
    } else if (offre.shift === 'nuit') {
      score -= 20; // Moins compatible pour les étudiants
    }

    // Analyser le type de job
    if (offre.jobType === 'stage') {
      score += 10; // Les stages sont souvent plus flexibles
    } else if (offre.jobType === 'freelance') {
      score += 20; // Très flexible
    }

    // Calculer le nombre de jours disponibles
    const joursDisponibles = [...new Set(disponibilites.map(d => d.jour))].length;
    if (joursDisponibles >= 3) {
      score += 15;
    } else if (joursDisponibles >= 2) {
      score += 10;
    } else {
      score -= 10;
    }

    // Calculer le total d'heures disponibles
    let totalHeures = 0;
    disponibilites.forEach(d => {
      if (d.heureFin) {
        const debut = this.parseHeure(d.heureDebut);
        const fin = this.parseHeure(d.heureFin);
        totalHeures += fin - debut;
      } else {
        totalHeures += 8; // Journée complète par défaut
      }
    });

    if (totalHeures >= 20) {
      score += 15;
    } else if (totalHeures >= 10) {
      score += 5;
    } else {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calcule le score basé sur les préférences
   */
  private calculatePreferenceScore(offre: OffreDocument, preferences?: any): number {
    let score = 50; // Score de base

    if (!preferences) {
      return score;
    }

    // Vérifier le type de job
    if (preferences.jobType && offre.jobType === preferences.jobType) {
      score += 25;
    }

    // Vérifier la ville
    if (preferences.city && offre.location?.city) {
      const cityMatch = offre.location.city.toLowerCase().includes(preferences.city.toLowerCase());
      if (cityMatch) {
        score += 25;
      }
    }

    // Vérifier le salaire minimum
    if (preferences.minSalary && offre.salary) {
      // Simple vérification si le salaire contient un nombre >= minSalary
      const salaryNumbers = offre.salary.match(/\d+/g);
      if (salaryNumbers && parseInt(salaryNumbers[0]) >= parseInt(preferences.minSalary)) {
        score += 20;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calcule le score basé sur le profil étudiant
   */
  private calculateProfileScore(
    offre: OffreDocument, 
    studentPreference: StudentPreferenceDocument | null
  ): number {
    let score = 50; // Score de base

    if (!studentPreference) {
      return score;
    }

    // Vérifier la motivation principale
    if (studentPreference.looking_for && offre.jobType) {
      if (
        (studentPreference.looking_for.toLowerCase() === 'job' && offre.jobType === 'job') ||
        (studentPreference.looking_for.toLowerCase() === 'stage' && offre.jobType === 'stage') ||
        (studentPreference.looking_for.toLowerCase() === 'freelance' && offre.jobType === 'freelance')
      ) {
        score += 30;
      }
    }

    // Correspondance des tags avec le domaine d'étude
    if (studentPreference.study_domain && offre.tags && offre.tags.length > 0) {
      const domainLower = studentPreference.study_domain.toLowerCase();
      const matchingTags = offre.tags.filter(tag => 
        tag.toLowerCase().includes(domainLower) || 
        domainLower.includes(tag.toLowerCase())
      );
      
      if (matchingTags.length > 0) {
        score += Math.min(20, matchingTags.length * 10);
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Génère les raisons du matching
   */
  private generateReasons(
    offre: OffreDocument,
    timeScore: number,
    preferenceScore: number,
    profileScore: number,
    disponibilites: any[]
  ): MatchingReasonDto[] {
    const reasons: MatchingReasonDto[] = [];

    // Raisons liées au temps
    if (timeScore >= 70) {
      reasons.push({
        type: 'positive',
        message: 'Vos horaires correspondent bien aux besoins de ce poste',
        weight: 0.8,
      });
    } else if (timeScore < 40) {
      reasons.push({
        type: 'negative',
        message: 'Vos disponibilités sont limitées pour ce poste',
        weight: 0.7,
      });
    }

    // Raisons liées au shift
    if (offre.shift === 'flexible') {
      reasons.push({
        type: 'positive',
        message: 'Horaires flexibles - Idéal pour les étudiants',
        weight: 0.9,
      });
    }

    // Raisons liées au type de job
    if (offre.jobType === 'stage') {
      reasons.push({
        type: 'positive',
        message: 'Stage étudiant - Compatible avec vos études',
        weight: 0.7,
      });
    } else if (offre.jobType === 'freelance') {
      reasons.push({
        type: 'positive',
        message: 'Freelance - Gestion autonome de votre temps',
        weight: 0.8,
      });
    }

    // Raisons liées au profil
    if (profileScore >= 70) {
      reasons.push({
        type: 'positive',
        message: 'Ce poste correspond bien à votre profil et vos compétences',
        weight: 0.9,
      });
    }

    // Raisons liées aux préférences
    if (preferenceScore >= 70) {
      reasons.push({
        type: 'positive',
        message: 'Cette offre répond à vos critères de recherche',
        weight: 0.8,
      });
    }

    // Analyse du nombre de jours disponibles
    const joursDisponibles = [...new Set(disponibilites.map(d => d.jour))].length;
    if (joursDisponibles >= 4) {
      reasons.push({
        type: 'positive',
        message: `Vous êtes disponible ${joursDisponibles} jours par semaine - Excellente flexibilité`,
        weight: 0.7,
      });
    } else if (joursDisponibles <= 2) {
      reasons.push({
        type: 'neutral',
        message: `Disponibilité limitée (${joursDisponibles} jours) - Vérifiez les exigences du poste`,
        weight: 0.6,
      });
    }

    return reasons;
  }

  /**
   * Génère une recommandation avec IA (Hugging Face)
   */
  private async generateAIRecommendation(
    offre: OffreDocument,
    score: number,
    reasons: MatchingReasonDto[],
    studentPreference: StudentPreferenceDocument | null
  ): Promise<string> {
    // Si Hugging Face n'est pas disponible, utiliser une recommandation locale
    if (!this.hf) {
      return this.generateLocalRecommendation(score);
    }

    try {
      // Préparer le prompt pour le modèle
      const prompt = this.buildRecommendationPrompt(offre, score, reasons, studentPreference);

      // Appeler Hugging Face (modèle de génération de texte)
      const response = await this.hf.textGeneration({
        model: 'mistralai/Mistral-7B-Instruct-v0.2', // Modèle gratuit et performant
        inputs: prompt,
        parameters: {
          max_new_tokens: 100,
          temperature: 0.7,
          top_p: 0.95,
          return_full_text: false,
        },
      });

      const recommendation = response.generated_text.trim();
      
      // Nettoyer et valider la recommandation
      if (recommendation.length > 10 && recommendation.length < 300) {
        return recommendation;
      } else {
        this.logger.warn('Recommandation IA invalide, utilisation du fallback');
        return this.generateLocalRecommendation(score);
      }
    } catch (error) {
      this.logger.error('Erreur lors de la génération IA:', error);
      return this.generateLocalRecommendation(score);
    }
  }

  /**
   * Construit le prompt pour Hugging Face
   */
  private buildRecommendationPrompt(
    offre: OffreDocument,
    score: number,
    reasons: MatchingReasonDto[],
    studentPreference: StudentPreferenceDocument | null
  ): string {
    const positiveReasons = reasons.filter(r => r.type === 'positive').map(r => r.message).join(', ');
    const negativeReasons = reasons.filter(r => r.type === 'negative').map(r => r.message).join(', ');

    return `Tu es un conseiller d'orientation pour étudiants tunisiens. 

Offre: ${offre.title} chez ${offre.company}
Type: ${offre.jobType}
Ville: ${offre.location?.city || 'Non spécifié'}
Score de compatibilité: ${score}/100

Points positifs: ${positiveReasons || 'Aucun'}
Points négatifs: ${negativeReasons || 'Aucun'}

Génère une recommandation courte (2 phrases max) et personnalisée pour cette offre. Sois encourageant si le score est élevé, constructif si moyen, et honnête si faible.

Recommandation:`;
  }

  /**
   * Génère une recommandation locale (sans IA)
   */
  private generateLocalRecommendation(score: number): string {
    if (score >= 80) {
      return 'Excellente opportunité ! Cette offre correspond parfaitement à votre profil et vos disponibilités. Nous vous recommandons fortement de postuler.';
    } else if (score >= 60) {
      return 'Bonne compatibilité avec votre profil. Cette offre mérite votre attention et pourrait correspondre à vos besoins.';
    } else if (score >= 40) {
      return 'Compatibilité moyenne. Vérifiez les détails de l\'offre pour vous assurer qu\'elle correspond à vos attentes.';
    } else {
      return 'Compatibilité limitée. Il pourrait y avoir des défis d\'organisation avec cette offre. Explorez d\'autres opportunités mieux adaptées.';
    }
  }

  /**
   * Utilitaires
   */
  private parseHeure(heure: string): number {
    const [h, m] = heure.split(':').map(Number);
    return h + (m / 60);
  }

  private extractHoraire(offre: OffreDocument): string {
    const shift = offre.shift || 'Non spécifié';
    const jobType = offre.jobType || '';
    
    if (shift === 'flexible') {
      return 'Horaires flexibles';
    } else if (shift === 'jour') {
      return 'Journée (environ 09:00-17:00)';
    } else if (shift === 'nuit') {
      return 'Horaires de nuit';
    }
    
    return `${jobType} - ${shift}`;
  }
}

