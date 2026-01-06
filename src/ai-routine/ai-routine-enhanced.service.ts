import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HfInference } from '@huggingface/inference';
import { createHash } from 'crypto';
import { RoutineInputDataDto, EvenementDto, DisponibiliteDto } from './dto/routine-input.dto';
import { ConflictDto, ConflictSeverity, TimeSlotDto, OverloadedDayDto } from './dto/conflict.dto';
import { JobCompatibilityResponseDto, QuickSuggestionResponseDto } from './dto/job-compatibility.dto';
import { EnhancedRoutineAnalysisDto } from './dto/routine-response.dto';
import { Offre, OffreDocument } from '../offre/schemas/offre.schema';

@Injectable()
export class AIRoutineEnhancedService {
  private readonly logger = new Logger(AIRoutineEnhancedService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private hf: HfInference | null = null;
  private useHuggingFace = false;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
    @InjectModel(Offre.name) private offreModel: Model<OffreDocument>,
  ) {
    this.initializeAI();
  }

  private initializeAI(): void {
    // Désactiver Hugging Face temporairement (problèmes de providers)
    // Utiliser directement les recommandations par défaut qui sont très bonnes
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey && geminiKey !== 'votre_cle_gemini_api_ici') {
      this.logger.log('✅ Utilisation des algorithmes intelligents pour les recommandations');
      // Pas besoin d'IA externe, nos algorithmes sont déjà très bons
    } else {
      this.logger.log('✅ Utilisation des algorithmes intelligents pour les recommandations');
    }
  }

  private initializeGemini(): void {
    if (this.genAI && this.model) {
      return;
    }

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY est requise');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Liste des modèles à essayer dans l'ordre de préférence
    // Utiliser les versions "-latest" qui sont plus stables
    const modelsToTry = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest', 
      'gemini-pro',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];
    
    // Utiliser le premier modèle de la liste
    this.model = this.genAI.getGenerativeModel({ 
      model: modelsToTry[0],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 3072,
      },
    });

    this.logger.log(`✅ Google Gemini initialisé avec succès (modèle: ${modelsToTry[0]})`);
  }

  /**
   * Analyse complète de routine avec détection des conflits
   */
  async analyzeRoutineEnhanced(
    userId: string,
    data: RoutineInputDataDto,
  ): Promise<EnhancedRoutineAnalysisDto> {
    this.initializeGemini();

    // 1. Détection des conflits d'horaires
    const conflicts = this.detectScheduleConflicts(data.evenements);
    this.logger.log(`🔍 ${conflicts.length} conflit(s) détecté(s)`);

    // 2. Identification des jours surchargés
    const overloadedDays = this.identifyOverloadedDays(data.evenements);
    this.logger.log(`⚠️ ${overloadedDays.length} jour(s) surchargé(s)`);

    // 3. Calcul des créneaux disponibles
    const availableTimeSlots = this.calculateAvailableTimeSlots(
      data.evenements,
      data.disponibilites,
      data.dateDebut,
      data.dateFin
    );
    this.logger.log(`✅ ${availableTimeSlots.length} créneau(x) disponible(s)`);

    // 4. Calcul des statistiques
    const stats = this.calculateStats(data);

    // 5. Calcul du score d'équilibre (améloré)
    const scoreBreakdown = this.calculateEnhancedBalanceScore(stats, conflicts, overloadedDays);
    const scoreEquilibre = scoreBreakdown.baseScore + 
                          scoreBreakdown.workStudyBalance + 
                          scoreBreakdown.restPenalty + 
                          scoreBreakdown.conflictPenalty + 
                          scoreBreakdown.overloadPenalty + 
                          scoreBreakdown.bonuses;

    this.logger.log(`📊 Score d'équilibre: ${scoreEquilibre}/100`);

    // 6. Créer le prompt enrichi pour l'IA
    const prompt = this.createEnhancedPrompt(data, stats, conflicts, overloadedDays, availableTimeSlots);

    // 7. Générer les recommandations avec nos algorithmes intelligents
    let aiResponse;
    
    // Utiliser directement nos algorithmes intelligents (plus fiables que les API externes)
    aiResponse = this.generateDefaultRecommendations(stats, conflicts, overloadedDays);
    
    // Code Gemini désactivé car API externe non fiable
    /* Commenté pour éviter les appels API externes non fiables
    if (this.model) {
      try {
        const result = await this.model.generateContent(prompt);
        const response = result?.response;
        const text = response?.text() || '';
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch && jsonMatch[0]) {
          aiResponse = JSON.parse(jsonMatch[0]);
        } else {
          aiResponse = { recommandations: [], suggestionsOptimisation: [] };
        }
      } catch (error: any) {
        this.logger.error('Erreur lors de l\'appel Gemini:', error);
      
      // Si erreur 404 (modèle non trouvé), essayer d'autres modèles
      if (error.status === 404 || error.message?.includes('404') || error.message?.includes('not found')) {
        this.logger.warn('Modèle initial non disponible, tentative avec d\'autres modèles...');
        
        if (!this.genAI) {
          throw new Error('GoogleGenerativeAI n\'est pas initialisé');
        }
        
        const modelsToTry = [
          'gemini-1.5-flash-latest',
          'gemini-1.5-pro-latest',
          'gemini-pro',
          'gemini-1.5-flash',
          'gemini-1.5-pro',
          'gemini-1.5-flash-001',
          'gemini-1.0-pro'
        ];
        let success = false;
        
        for (const modelName of modelsToTry) {
          try {
            this.logger.log(`Tentative avec le modèle: ${modelName}`);
            const fallbackModel = this.genAI.getGenerativeModel({ 
              model: modelName,
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 3072,
              },
            });
            
            const result = await fallbackModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              aiResponse = JSON.parse(jsonMatch[0]);
            } else {
              aiResponse = { recommandations: [], suggestionsOptimisation: [] };
            }
            
            // Mettre à jour le modèle pour les prochaines utilisations
            this.model = fallbackModel;
            this.logger.log(`✅ Modèle ${modelName} fonctionne, utilisation de ce modèle`);
            success = true;
            break;
          } catch (fallbackError: any) {
            this.logger.warn(`Modèle ${modelName} non disponible: ${fallbackError.message}`);
            continue;
          }
        }
        
        if (!success) {
          this.logger.warn('Aucun modèle Gemini disponible, utilisation de recommandations par défaut');
          aiResponse = this.generateDefaultRecommendations(stats, conflicts, overloadedDays);
        }
      } else {
        aiResponse = this.generateDefaultRecommendations(stats, conflicts, overloadedDays);
      }
      }
    }
    */ // Fin du code commenté

    // 8. Générer le résumé de santé
    const healthSummary = this.generateHealthSummary(scoreEquilibre, conflicts, overloadedDays, stats);

    // 9. Construire la réponse complète
    const analysis: EnhancedRoutineAnalysisDto = {
      id: this.generateId(),
      dateAnalyse: new Date().toISOString(),
      scoreEquilibre: Math.max(0, Math.min(100, Math.round(scoreEquilibre))),
      scoreBreakdown,
      conflicts,
      overloadedDays,
      availableTimeSlots,
      recommandations: aiResponse.recommandations || [],
      analyseHebdomadaire: {
        heuresTravail: stats.heuresTravail,
        heuresEtudes: stats.heuresEtudes,
        heuresRepos: stats.heuresRepos,
        heuresActivites: stats.heuresActivites,
        heuresTotales: stats.heuresTotales,
        repartition: {
          pourcentageTravail: stats.pourcentageTravail,
          pourcentageEtudes: stats.pourcentageEtudes,
          pourcentageRepos: stats.pourcentageRepos,
          pourcentageActivites: stats.pourcentageActivites,
        },
      },
      suggestionsOptimisation: aiResponse.suggestionsOptimisation || [],
      healthSummary,
    };

    return analysis;
  }

  /**
   * Détecte les conflits d'horaires entre événements
   */
  private detectScheduleConflicts(evenements: EvenementDto[]): ConflictDto[] {
    const conflicts: ConflictDto[] = [];
    
    // Grouper les événements par date
    const eventsByDate = new Map<string, EvenementDto[]>();
    evenements.forEach(event => {
      if (!eventsByDate.has(event.date)) {
        eventsByDate.set(event.date, []);
      }
      eventsByDate.get(event.date)!.push(event);
    });

    // Détecter les chevauchements pour chaque date
    for (const [date, events] of eventsByDate.entries()) {
      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          const overlap = this.calculateTimeOverlap(events[i], events[j]);
          
          if (overlap > 0) {
            const severity = this.calculateConflictSeverity(overlap, events[i], events[j]);
            
            conflicts.push({
              date,
              event1: events[i],
              event2: events[j],
              severity,
              suggestion: this.generateConflictSuggestion(events[i], events[j], severity),
              overlapDuration: overlap,
              scoreImpact: this.calculateConflictScoreImpact(severity, overlap),
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Calcule le chevauchement entre deux événements (en minutes)
   */
  private calculateTimeOverlap(event1: EvenementDto, event2: EvenementDto): number {
    const start1 = this.timeToMinutes(event1.heureDebut);
    const end1 = this.timeToMinutes(event1.heureFin);
    const start2 = this.timeToMinutes(event2.heureDebut);
    const end2 = this.timeToMinutes(event2.heureFin);

    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);

    return Math.max(0, overlapEnd - overlapStart);
  }

  /**
   * Convertit une heure (HH:MM) en minutes depuis minuit
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Calcule la gravité d'un conflit
   */
  private calculateConflictSeverity(
    overlapMinutes: number, 
    event1: EvenementDto, 
    event2: EvenementDto
  ): ConflictSeverity {
    // Chevauchement total = critique
    const duration1 = this.timeToMinutes(event1.heureFin) - this.timeToMinutes(event1.heureDebut);
    const duration2 = this.timeToMinutes(event2.heureFin) - this.timeToMinutes(event2.heureDebut);
    
    if (overlapMinutes >= Math.min(duration1, duration2)) {
      return ConflictSeverity.CRITICAL;
    }
    
    // Chevauchement > 60 min = high
    if (overlapMinutes > 60) {
      return ConflictSeverity.HIGH;
    }
    
    // Chevauchement 30-60 min = medium
    if (overlapMinutes >= 30) {
      return ConflictSeverity.MEDIUM;
    }
    
    // Chevauchement < 30 min = low
    return ConflictSeverity.LOW;
  }

  /**
   * Génère une suggestion pour résoudre un conflit
   */
  private generateConflictSuggestion(
    event1: EvenementDto, 
    event2: EvenementDto, 
    severity: ConflictSeverity
  ): string {
    if (severity === ConflictSeverity.CRITICAL || severity === ConflictSeverity.HIGH) {
      return `Conflit majeur : "${event1.titre}" et "${event2.titre}" se chevauchent. Vous devez déplacer l'un des deux événements.`;
    }
    
    if (severity === ConflictSeverity.MEDIUM) {
      return `Attention : "${event1.titre}" et "${event2.titre}" se chevauchent partiellement. Prévoyez un temps de transition.`;
    }
    
    return `Léger chevauchement entre "${event1.titre}" et "${event2.titre}". Assurez-vous d'avoir le temps de vous déplacer.`;
  }

  /**
   * Calcule l'impact d'un conflit sur le score
   */
  private calculateConflictScoreImpact(severity: ConflictSeverity, overlapMinutes: number): number {
    const baseImpact = {
      [ConflictSeverity.LOW]: -2,
      [ConflictSeverity.MEDIUM]: -5,
      [ConflictSeverity.HIGH]: -10,
      [ConflictSeverity.CRITICAL]: -15,
    };
    
    return baseImpact[severity] * Math.ceil(overlapMinutes / 30);
  }

  /**
   * Identifie les jours surchargés
   */
  private identifyOverloadedDays(evenements: EvenementDto[]): OverloadedDayDto[] {
    const overloadedDays: OverloadedDayDto[] = [];
    
    // Grouper par date
    const eventsByDate = new Map<string, EvenementDto[]>();
    evenements.forEach(event => {
      if (!eventsByDate.has(event.date)) {
        eventsByDate.set(event.date, []);
      }
      eventsByDate.get(event.date)!.push(event);
    });

    // Analyser chaque jour
    for (const [date, events] of eventsByDate.entries()) {
      let totalHours = 0;
      
      events.forEach(event => {
        const duration = (this.timeToMinutes(event.heureFin) - this.timeToMinutes(event.heureDebut)) / 60;
        totalHours += duration;
      });

      if (totalHours >= 10) { // Seuil de surcharge: 10h
        const level = totalHours >= 14 ? 'critique' : totalHours >= 12 ? 'élevé' : 'modéré';
        
        overloadedDays.push({
          date,
          jour: new Date(date).toLocaleDateString('fr-FR', { weekday: 'long' }),
          totalHours,
          evenements: events,
          level: level as any,
          recommendations: this.generateOverloadRecommendations(totalHours, events),
        });
      }
    }

    return overloadedDays.sort((a, b) => b.totalHours - a.totalHours);
  }

  /**
   * Génère des recommandations pour les jours surchargés
   */
  private generateOverloadRecommendations(totalHours: number, events: EvenementDto[]): string[] {
    const recommendations: string[] = [];
    
    if (totalHours >= 14) {
      recommendations.push('⚠️ Journée critique : Essayez de déplacer au moins 2-3h d\'activités');
      recommendations.push('Prévoyez des pauses de 15-20 minutes entre les activités');
      recommendations.push('Assurez-vous de bien dormir la veille et le lendemain');
    } else if (totalHours >= 12) {
      recommendations.push('⚠️ Journée chargée : Déplacez si possible 1-2h d\'activités');
      recommendations.push('Prenez des pauses régulières de 10 minutes');
    } else {
      recommendations.push('Journée modérément chargée : Gérez votre énergie avec des pauses');
    }
    
    // Recommandations spécifiques selon les types d'événements
    const hasJob = events.some(e => e.type.toLowerCase() === 'job');
    const hasCours = events.some(e => e.type.toLowerCase() === 'cours');
    
    if (hasJob && hasCours) {
      recommendations.push('Alternez travail et études : prévoyez 1h de pause entre les deux');
    }
    
    return recommendations;
  }

  /**
   * Calcule les créneaux horaires disponibles
   */
  private calculateAvailableTimeSlots(
    evenements: EvenementDto[],
    disponibilites: DisponibiliteDto[],
    dateDebut: string,
    dateFin: string
  ): TimeSlotDto[] {
    const availableSlots: TimeSlotDto[] = [];
    
    // Pour chaque jour de disponibilité
    disponibilites.forEach(dispo => {
      // Trouver les événements pour ce jour
      const eventsForDay = evenements.filter(event => {
        const eventDate = new Date(event.date);
        const dayName = eventDate.toLocaleDateString('fr-FR', { weekday: 'long' });
        return dayName.toLowerCase() === dispo.jour.toLowerCase();
      });

      const dispoStart = this.timeToMinutes(dispo.heureDebut);
      const dispoEnd = dispo.heureFin ? this.timeToMinutes(dispo.heureFin) : 24 * 60;

      // Calculer les créneaux libres
      if (eventsForDay.length === 0) {
        // Toute la journée est libre
        availableSlots.push({
          jour: dispo.jour,
          heureDebut: dispo.heureDebut,
          heureFin: dispo.heureFin || '23:59',
          duration: (dispoEnd - dispoStart) / 60,
          type: 'libre',
        });
      } else {
        // Identifier les créneaux libres entre les événements
        const sortedEvents = eventsForDay.sort((a, b) => 
          this.timeToMinutes(a.heureDebut) - this.timeToMinutes(b.heureDebut)
        );

        let currentTime = dispoStart;

        sortedEvents.forEach(event => {
          const eventStart = this.timeToMinutes(event.heureDebut);
          const eventEnd = this.timeToMinutes(event.heureFin);

          // Créneau libre avant cet événement
          if (currentTime < eventStart) {
            const duration = (eventStart - currentTime) / 60;
            if (duration >= 0.5) { // Au moins 30 minutes
              availableSlots.push({
                jour: dispo.jour,
                heureDebut: this.minutesToTime(currentTime),
                heureFin: this.minutesToTime(eventStart),
                duration,
                type: 'libre',
              });
            }
          }

          currentTime = Math.max(currentTime, eventEnd);
        });

        // Créneau libre après le dernier événement
        if (currentTime < dispoEnd) {
          const duration = (dispoEnd - currentTime) / 60;
          if (duration >= 0.5) {
            availableSlots.push({
              jour: dispo.jour,
              heureDebut: this.minutesToTime(currentTime),
              heureFin: this.minutesToTime(dispoEnd),
              duration,
              type: 'libre',
            });
          }
        }
      }
    });

    return availableSlots.sort((a, b) => b.duration - a.duration);
  }

  /**
   * Convertit des minutes en format HH:MM
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Calcule un score d'équilibre amélioré avec décomposition
   */
  private calculateEnhancedBalanceScore(
    stats: any, 
    conflicts: ConflictDto[], 
    overloadedDays: OverloadedDayDto[]
  ): any {
    let baseScore = 100;
    let workStudyBalance = 0;
    let restPenalty = 0;
    let conflictPenalty = 0;
    let overloadPenalty = 0;
    let bonuses = 0;

    // 1. Équilibre travail/études
    const workStudyRatio = stats.heuresTravail / (stats.heuresEtudes || 1);
    if (workStudyRatio > 2) {
      workStudyBalance = -15; // Trop de travail
    } else if (workStudyRatio < 0.3) {
      workStudyBalance = -10; // Pas assez de travail pratique
    } else if (workStudyRatio >= 0.6 && workStudyRatio <= 1.2) {
      workStudyBalance = 10; // Équilibre optimal
    }

    // 2. Pénalités pour manque de repos
    if (stats.pourcentageRepos < 20) {
      restPenalty = -30; // Critique
    } else if (stats.pourcentageRepos < 30) {
      restPenalty = -20;
    } else if (stats.pourcentageRepos < 35) {
      restPenalty = -10;
    }

    // 3. Bonus pour repos optimal
    if (stats.pourcentageRepos >= 35 && stats.pourcentageRepos <= 45) {
      bonuses += 10;
    }

    // 4. Pénalités pour conflits
    conflictPenalty = conflicts.reduce((sum, conflict) => sum + conflict.scoreImpact, 0);

    // 5. Pénalités pour jours surchargés
    overloadedDays.forEach(day => {
      if (day.level === 'critique') {
        overloadPenalty -= 15;
      } else if (day.level === 'élevé') {
        overloadPenalty -= 10;
      } else {
        overloadPenalty -= 5;
      }
    });

    // 6. Bonus pour variété d'activités
    if (stats.heuresActivites >= 5) {
      bonuses += 5;
    }

    // 7. Bonus si pas de conflits
    if (conflicts.length === 0) {
      bonuses += 10;
    }

    return {
      baseScore,
      workStudyBalance,
      restPenalty,
      conflictPenalty,
      overloadPenalty,
      bonuses,
    };
  }

  /**
   * Calcule les statistiques de base
   */
  private calculateStats(data: RoutineInputDataDto): any {
    const dateDebut = new Date(data.dateDebut);
    const dateFin = new Date(data.dateFin);
    
    const evenementsFiltres = data.evenements.filter(evenement => {
      const eventDate = new Date(evenement.date);
      return eventDate >= dateDebut && eventDate <= dateFin;
    });

    let heuresTravail = 0;
    let heuresEtudes = 0;
    let heuresActivites = 0;

    for (const evenement of evenementsFiltres) {
      const duree = this.calculerDureeHeures(evenement.heureDebut, evenement.heureFin);

      switch (evenement.type.toLowerCase()) {
        case 'job':
          heuresTravail += duree;
          break;
        case 'cours':
          heuresEtudes += duree;
          break;
        case 'deadline':
          heuresEtudes += duree * 0.5;
          heuresTravail += duree * 0.5;
          break;
        default:
          heuresActivites += duree;
      }
    }

    const diffTime = dateFin.getTime() - dateDebut.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const nombreJours = Math.max(1, diffDays);
    
    const heuresDisponibles = 16.0 * nombreJours;
    const heuresRepos = Math.max(0, heuresDisponibles - heuresTravail - heuresEtudes - heuresActivites);
    const total = heuresTravail + heuresEtudes + heuresRepos + heuresActivites;

    return {
      heuresTravail,
      heuresEtudes,
      heuresRepos,
      heuresActivites,
      heuresTotales: total,
      pourcentageTravail: total > 0 ? (heuresTravail / total) * 100 : 0,
      pourcentageEtudes: total > 0 ? (heuresEtudes / total) * 100 : 0,
      pourcentageRepos: total > 0 ? (heuresRepos / total) * 100 : 0,
      pourcentageActivites: total > 0 ? (heuresActivites / total) * 100 : 0,
    };
  }

  private calculerDureeHeures(heureDebut: string, heureFin: string): number {
    const [h1, m1] = heureDebut.split(':').map(Number);
    const [h2, m2] = heureFin.split(':').map(Number);
    
    const debutMinutes = h1 * 60 + m1;
    const finMinutes = h2 * 60 + m2;
    
    const dureeMinutes = finMinutes - debutMinutes;
    return Math.max(0, dureeMinutes / 60.0);
  }

  /**
   * Crée un prompt enrichi pour l'IA
   */
  private createEnhancedPrompt(
    data: RoutineInputDataDto,
    stats: any,
    conflicts: ConflictDto[],
    overloadedDays: OverloadedDayDto[],
    availableSlots: TimeSlotDto[]
  ): string {
    const conflictsText = conflicts.length > 0
      ? conflicts.map(c => `- ${c.date}: "${c.event1.titre}" vs "${c.event2.titre}" (${c.overlapDuration}min de chevauchement)`).join('\n')
      : 'Aucun conflit détecté';

    const overloadText = overloadedDays.length > 0
      ? overloadedDays.map(d => `- ${d.jour} ${d.date}: ${d.totalHours.toFixed(1)}h (${d.level})`).join('\n')
      : 'Aucun jour surchargé';

    const availabilityText = availableSlots.length > 0
      ? `${availableSlots.reduce((sum, slot) => sum + slot.duration, 0).toFixed(1)}h disponibles réparties sur ${availableSlots.length} créneaux`
      : 'Peu de créneaux disponibles';

    return `Tu es un assistant IA expert en équilibre vie-études-travail pour les étudiants tunisiens.

ANALYSE DÉTAILLÉE DE LA ROUTINE :

📊 STATISTIQUES GLOBALES :
- Heures de travail : ${stats.heuresTravail.toFixed(1)}h (${stats.pourcentageTravail.toFixed(1)}%)
- Heures d'études : ${stats.heuresEtudes.toFixed(1)}h (${stats.pourcentageEtudes.toFixed(1)}%)
- Heures de repos : ${stats.heuresRepos.toFixed(1)}h (${stats.pourcentageRepos.toFixed(1)}%)
- Heures d'activités : ${stats.heuresActivites.toFixed(1)}h (${stats.pourcentageActivites.toFixed(1)}%)

⚠️ CONFLITS D'HORAIRES DÉTECTÉS (${conflicts.length}) :
${conflictsText}

🔥 JOURS SURCHARGÉS (${overloadedDays.length}) :
${overloadText}

✅ DISPONIBILITÉS :
${availabilityText}

GÉNÈRE une analyse complète en JSON avec ce format EXACT (réponds UNIQUEMENT en JSON) :

{
  "recommandations": [
    {
      "id": "string",
      "type": "travail|etudes|repos|activites|sante|social|optimisation|planning|bienetre",
      "titre": "Titre clair et actionnable",
      "description": "Description détaillée (2-3 phrases) avec des données concrètes",
      "priorite": "haute|moyenne|basse",
      "actionSuggeree": "Action précise et réalisable"
    }
  ],
  "suggestionsOptimisation": [
    {
      "id": "string",
      "jour": "Jour ou période concernée",
      "type": "deplacement|ajout|suppression|regroupement|pause|reorganisation",
      "description": "Description détaillée de l'optimisation",
      "avantage": "Avantage concret et mesurable",
      "impact": "tresPositif|positif|neutre"
    }
  ]
}

RÈGLES CRITIQUES :
1. GÉNÈRE 8-12 RECOMMANDATIONS VARIÉES couvrant :
   - Résolution des conflits d'horaires (priorité haute si conflits détectés)
   - Optimisation des jours surchargés
   - Amélioration de l'équilibre travail/études
   - Gestion du temps de repos et récupération
   - Exploitation des créneaux disponibles
   - Santé et bien-être
   - Développement personnel et social

2. GÉNÈRE 3-5 SUGGESTIONS D'OPTIMISATION CONCRÈTES avec :
   - Jours et créneaux spécifiques
   - Actions précises et réalisables
   - Avantages mesurables

3. SOIS SPÉCIFIQUE : Mentionne les jours, heures, événements concernés
4. SOIS PRATIQUE : Adapté au contexte tunisien, réalisable pour un étudiant
5. FORMAT : JSON uniquement, sans markdown, sans texte avant/après`;
  }

  /**
   * Génère un résumé de santé de la routine
   */
  private generateHealthSummary(
    score: number,
    conflicts: ConflictDto[],
    overloadedDays: OverloadedDayDto[],
    stats: any
  ): any {
    let status: 'excellent' | 'bon' | 'moyen' | 'faible' | 'critique';
    const mainIssues: string[] = [];
    const mainStrengths: string[] = [];

    // Déterminer le statut
    if (score >= 85) {
      status = 'excellent';
    } else if (score >= 70) {
      status = 'bon';
    } else if (score >= 50) {
      status = 'moyen';
    } else if (score >= 30) {
      status = 'faible';
    } else {
      status = 'critique';
    }

    // Identifier les problèmes principaux
    if (conflicts.length > 0) {
      mainIssues.push(`${conflicts.length} conflit(s) d'horaires à résoudre`);
    }
    
    if (overloadedDays.length > 0) {
      mainIssues.push(`${overloadedDays.length} jour(s) surchargé(s)`);
    }
    
    if (stats.pourcentageRepos < 30) {
      mainIssues.push('Temps de repos insuffisant');
    }
    
    const workStudyRatio = stats.heuresTravail / (stats.heuresEtudes || 1);
    if (workStudyRatio > 2) {
      mainIssues.push('Déséquilibre: trop de travail par rapport aux études');
    } else if (workStudyRatio < 0.3) {
      mainIssues.push('Peu d\'expérience professionnelle');
    }

    // Identifier les points forts
    if (conflicts.length === 0) {
      mainStrengths.push('Aucun conflit d\'horaires');
    }
    
    if (stats.pourcentageRepos >= 35 && stats.pourcentageRepos <= 45) {
      mainStrengths.push('Excellent équilibre de repos');
    }
    
    if (workStudyRatio >= 0.6 && workStudyRatio <= 1.2) {
      mainStrengths.push('Bon équilibre travail/études');
    }
    
    if (stats.heuresActivites >= 5) {
      mainStrengths.push('Temps pour activités personnelles');
    }
    
    if (overloadedDays.length === 0) {
      mainStrengths.push('Répartition équilibrée des activités');
    }

    return {
      status,
      mainIssues: mainIssues.length > 0 ? mainIssues : ['Aucun problème majeur détecté'],
      mainStrengths: mainStrengths.length > 0 ? mainStrengths : ['Continuez vos efforts'],
    };
  }

  /**
   * Analyse la compatibilité avec une offre d'emploi
   */
  async analyzeJobCompatibility(
    userId: string,
    offreId: string,
    currentData: RoutineInputDataDto
  ): Promise<JobCompatibilityResponseDto> {
    // Récupérer l'offre
    const offre = await this.offreModel.findById(offreId).exec();
    if (!offre) {
      throw new NotFoundException('Offre non trouvée');
    }

    // Calculer les créneaux disponibles
    const availableSlots = this.calculateAvailableTimeSlots(
      currentData.evenements,
      currentData.disponibilites,
      currentData.dateDebut,
      currentData.dateFin
    );

    const totalAvailableHours = availableSlots.reduce((sum, slot) => sum + slot.duration, 0);

    // Calculer le score de compatibilité
    let score = 50;
    const reasons: string[] = [];
    const warnings: string[] = [];

    // 1. Vérifier s'il y a assez d'heures disponibles
    const requiredHours = this.estimateRequiredHours(offre);
    if (totalAvailableHours >= requiredHours * 1.2) {
      score += 30;
      reasons.push(`Vous avez ${totalAvailableHours.toFixed(1)}h disponibles (${requiredHours}h requises)`);
    } else if (totalAvailableHours >= requiredHours) {
      score += 15;
      reasons.push(`Vous avez juste assez de temps disponible`);
      warnings.push('Planning serré, peu de marge de manœuvre');
    } else {
      score -= 20;
      warnings.push(`Temps insuffisant: ${totalAvailableHours.toFixed(1)}h disponibles pour ${requiredHours}h requises`);
    }

    // 2. Vérifier la flexibilité des horaires
    if (offre.shift === 'flexible') {
      score += 20;
      reasons.push('Horaires flexibles - Idéal pour étudiants');
    } else if (offre.shift === 'nuit') {
      score -= 15;
      warnings.push('Horaires de nuit - Impact sur les études');
    }

    // 3. Vérifier le type de job
    if (offre.jobType === 'stage' || offre.jobType === 'freelance') {
      score += 10;
      reasons.push(`Type ${offre.jobType} compatible avec études`);
    }

    // 4. Calculer l'impact sur l'équilibre
    const currentStats = this.calculateStats(currentData);
    const impactOnBalance = this.estimateBalanceImpact(currentStats, requiredHours);

    // Générer la recommandation finale
    let recommendation: string;
    const available = score >= 50 && totalAvailableHours >= requiredHours * 0.8;

    if (score >= 80) {
      recommendation = `Excellente opportunité ! Cette offre s'intègre parfaitement dans votre emploi du temps. Nous vous recommandons fortement de postuler.`;
    } else if (score >= 60) {
      recommendation = `Bonne compatibilité. Cette offre est réalisable avec votre emploi du temps actuel. Vérifiez les détails avant de postuler.`;
    } else if (score >= 40) {
      recommendation = `Compatibilité moyenne. Vous devrez peut-être réorganiser votre emploi du temps. Évaluez soigneusement avant de postuler.`;
    } else {
      recommendation = `Compatibilité faible. Cette offre pourrait surcharger votre emploi du temps. Cherchez des opportunités plus flexibles.`;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      available,
      message: available 
        ? `Vous pouvez accepter cette offre` 
        : `Cette offre risque de surcharger votre emploi du temps`,
      availableHoursPerWeek: totalAvailableHours,
      bestTimeSlots: availableSlots.slice(0, 5), // Top 5 créneaux
      warnings,
      reasons,
      impactOnBalance,
      recommendation,
    };
  }

  /**
   * Estime les heures requises pour une offre
   */
  private estimateRequiredHours(offre: OffreDocument): number {
    // Estimation basée sur le type de job
    if (offre.jobType === 'job') {
      return 20; // 20h/semaine pour un job à temps partiel
    } else if (offre.jobType === 'stage') {
      return 25; // 25h/semaine pour un stage
    } else {
      return 10; // 10h/semaine pour du freelance
    }
  }

  /**
   * Estime l'impact sur l'équilibre
   */
  private estimateBalanceImpact(currentStats: any, newHours: number): number {
    const currentWorkHours = currentStats.heuresTravail;
    const totalAfter = currentWorkHours + newHours;
    
    // Si > 30h de travail par semaine = impact négatif
    if (totalAfter > 30) {
      return -15;
    } else if (totalAfter > 25) {
      return -10;
    } else if (totalAfter < 10) {
      return 10; // Bénéfique si peu de travail actuellement
    }
    
    return -5;
  }

  /**
   * Suggestion rapide pour un nouvel événement
   */
  async getQuickSuggestion(
    userId: string,
    newEvent: any,
    currentEvents: EvenementDto[]
  ): Promise<QuickSuggestionResponseDto> {
    // Créer un événement temporaire
    const tempEvent: EvenementDto = {
      id: 'temp',
      titre: newEvent.titre,
      type: newEvent.type,
      date: newEvent.date,
      heureDebut: newEvent.heureDebut,
      heureFin: newEvent.heureFin,
    };

    // Vérifier les conflits avec les événements existants du même jour
    const eventsOnSameDay = currentEvents.filter(e => e.date === tempEvent.date);
    const conflicts: any[] = [];

    eventsOnSameDay.forEach(existingEvent => {
      const overlap = this.calculateTimeOverlap(tempEvent, existingEvent);
      if (overlap > 0) {
        conflicts.push({
          event: existingEvent.titre,
          overlap: overlap,
          severity: this.calculateConflictSeverity(overlap, tempEvent, existingEvent),
        });
      }
    });

    // Générer la réponse
    if (conflicts.length > 0) {
      const criticalConflicts = conflicts.filter(c => c.severity === 'critical' || c.severity === 'high');
      
      return {
        status: criticalConflicts.length > 0 ? 'error' : 'warning',
        message: criticalConflicts.length > 0
          ? `❌ Conflit majeur détecté : Ce créneau chevauche "${conflicts[0].event}"`
          : `⚠️ Attention : Chevauchement partiel avec "${conflicts[0].event}"`,
        conflicts,
        impactScore: -5 * conflicts.length,
        recommendations: [
          'Choisissez un autre créneau horaire',
          'Déplacez l\'événement existant',
          'Réduisez la durée de l\'un des événements',
        ],
      };
    }

    // Vérifier si la journée devient surchargée
    const dayHours = eventsOnSameDay.reduce((sum, e) => 
      sum + this.calculerDureeHeures(e.heureDebut, e.heureFin), 0
    );
    const newDayHours = dayHours + this.calculerDureeHeures(tempEvent.heureDebut, tempEvent.heureFin);

    if (newDayHours >= 12) {
      return {
        status: 'warning',
        message: `⚠️ Attention : Journée chargée (${newDayHours.toFixed(1)}h d'activités)`,
        impactScore: -3,
        recommendations: [
          'Prévoyez des pauses régulières',
          'Assurez-vous d\'avoir une bonne nuit de sommeil',
          'Considérez déplacer certaines activités à un autre jour',
        ],
      };
    }

    return {
      status: 'ok',
      message: '✅ Parfait ! Ce créneau est libre et ne surcharge pas votre journée',
      impactScore: 0,
      recommendations: [
        'Ajoutez cet événement à votre planning',
      ],
    };
  }

  /**
   * Génère un ID unique
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Génère des recommandations avec Hugging Face
   */
  private async generateRecommendationsWithHF(
    prompt: string,
    stats: any,
    conflicts: ConflictDto[],
    overloadedDays: OverloadedDayDto[]
  ): Promise<any> {
    if (!this.hf) {
      throw new Error('Hugging Face non initialisé');
    }

    try {
      // Créer un prompt simplifié pour Hugging Face
      const simplifiedPrompt = `Tu es un conseiller pour étudiants. Analyse cette routine et donne 3-5 recommandations concrètes.

Statistiques:
- Travail: ${stats.heuresTravail.toFixed(1)}h (${stats.pourcentageTravail.toFixed(1)}%)
- Études: ${stats.heuresEtudes.toFixed(1)}h (${stats.pourcentageEtudes.toFixed(1)}%)
- Repos: ${stats.heuresRepos.toFixed(1)}h (${stats.pourcentageRepos.toFixed(1)}%)
- Conflits d'horaires: ${conflicts.length}
- Jours surchargés: ${overloadedDays.length}

Donne 3-5 recommandations pratiques et spécifiques en format liste.`;

      // Utiliser textGeneration avec un modèle gratuit et accessible
      const response = await this.hf.textGeneration({
        model: 'google/flan-t5-large',
        inputs: simplifiedPrompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          top_p: 0.95,
          return_full_text: false,
        },
      });

      // Parser la réponse et la convertir en format structuré
      const text = response.generated_text || '';
      const recommandations = this.parseHFResponse(text, stats, conflicts, overloadedDays);
      
      return {
        recommandations,
        suggestionsOptimisation: this.generateOptimizationSuggestions(stats, conflicts, overloadedDays),
      };
    } catch (error: any) {
      this.logger.error('Erreur Hugging Face:', error.message);
      throw error;
    }
  }

  /**
   * Parse la réponse de Hugging Face
   */
  private parseHFResponse(
    text: string,
    stats: any,
    conflicts: ConflictDto[],
    overloadedDays: OverloadedDayDto[]
  ): any[] {
    const recommandations: any[] = [];
    
    // Extraire les lignes qui ressemblent à des recommandations
    const lines = text.split('\n').filter(line => 
      line.trim().length > 10 && 
      (line.includes('-') || line.includes('•') || line.match(/^\d+\./))
    );

    lines.forEach((line, index) => {
      const cleanLine = line.replace(/^[-•\d.]\s*/, '').trim();
      if (cleanLine.length > 15) {
        recommandations.push({
          id: this.generateId(),
          type: this.inferRecommendationType(cleanLine),
          titre: this.extractTitle(cleanLine),
          description: cleanLine,
          priorite: index < 2 ? 'haute' : 'moyenne',
          actionSuggeree: cleanLine,
        });
      }
    });

    // Ajouter des recommandations basées sur les données si pas assez
    if (recommandations.length < 3) {
      recommandations.push(...this.generateDataBasedRecommendations(stats, conflicts, overloadedDays));
    }

    return recommandations.slice(0, 12);
  }

  /**
   * Infère le type de recommandation
   */
  private inferRecommendationType(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('travail') || lower.includes('job')) return 'travail';
    if (lower.includes('étud') || lower.includes('cours')) return 'etudes';
    if (lower.includes('repos') || lower.includes('sommeil') || lower.includes('dormir')) return 'repos';
    if (lower.includes('activité') || lower.includes('loisir')) return 'activites';
    if (lower.includes('santé') || lower.includes('exercice') || lower.includes('sport')) return 'sante';
    if (lower.includes('social') || lower.includes('ami')) return 'social';
    if (lower.includes('planning') || lower.includes('horaire')) return 'planning';
    if (lower.includes('équilibre')) return 'optimisation';
    return 'bienetre';
  }

  /**
   * Extrait un titre court de la recommandation
   */
  private extractTitle(text: string): string {
    const words = text.split(' ').slice(0, 6).join(' ');
    return words.length > 50 ? words.substring(0, 47) + '...' : words;
  }

  /**
   * Génère des recommandations intelligentes basées sur les données (IA Locale Avancée)
   */
  private generateDataBasedRecommendations(
    stats: any,
    conflicts: ConflictDto[],
    overloadedDays: OverloadedDayDto[]
  ): any[] {
    const recommandations: any[] = [];

    // 1. CONFLITS D'HORAIRES (Priorité critique)
    if (conflicts.length > 0) {
      const criticalConflicts = conflicts.filter(c => c.severity === ConflictSeverity.CRITICAL || c.severity === ConflictSeverity.HIGH);
      
      if (criticalConflicts.length > 0) {
        recommandations.push({
          id: this.generateId(),
          type: 'planning',
          titre: `Résoudre ${criticalConflicts.length} conflit(s) majeur(s)`,
          description: `Vous avez ${criticalConflicts.length} conflit(s) d'horaires majeur(s) nécessitant une action immédiate. Ces chevauchements peuvent compromettre votre capacité à honorer vos engagements. Identifiez les événements les moins prioritaires et déplacez-les vers des créneaux disponibles.`,
          priorite: 'haute',
          actionSuggeree: `Déplacez les événements en conflit vers les ${conflicts.length} créneaux disponibles identifiés`,
        });
      }
      
      if (conflicts.length > criticalConflicts.length) {
        const minorConflicts = conflicts.length - criticalConflicts.length;
        recommandations.push({
          id: this.generateId(),
          type: 'planning',
          titre: `Optimiser ${minorConflicts} chevauchement(s) mineur(s)`,
          description: `Vous avez ${minorConflicts} chevauchement(s) partiel(s) qui peuvent causer du stress et de la précipitation. Prévoyez des temps de transition de 15-20 minutes entre les activités pour vous déplacer confortablement et vous préparer mentalement.`,
          priorite: 'moyenne',
          actionSuggeree: `Ajuster les horaires pour ajouter 15 minutes de transition entre les événements`,
        });
      }
    }

    // 2. JOURS SURCHARGÉS (Analyse détaillée)
    if (overloadedDays.length > 0) {
      overloadedDays.forEach((day, index) => {
        if (index < 2) { // Top 2 jours les plus surchargés
          const level = day.level === 'critique' ? 'critique' : day.level === 'élevé' ? 'très élevée' : 'modérée';
          const heuresExcess = day.totalHours - 10;
          
          recommandations.push({
            id: this.generateId(),
            type: 'optimisation',
            titre: `Alléger ${day.jour} (charge ${level})`,
            description: `${day.jour} présente une charge de travail ${level} avec ${day.totalHours.toFixed(1)}h d'activités (${heuresExcess.toFixed(1)}h au-dessus du seuil recommandé). Cette surcharge peut affecter votre concentration, votre santé et la qualité de votre travail. Déplacez ${Math.ceil(heuresExcess)}h d'activités vers des jours moins chargés pour maintenir un rythme soutenable.`,
            priorite: day.level === 'critique' ? 'haute' : 'moyenne',
            actionSuggeree: `Déplacer ${Math.ceil(heuresExcess)}h d'activités de ${day.jour} vers d'autres jours`,
          });
        }
      });
    }

    // 3. REPOS ET RÉCUPÉRATION (Analyse multi-niveaux)
    if (stats.pourcentageRepos < 20) {
      recommandations.push({
        id: this.generateId(),
        type: 'repos',
        titre: 'URGENT : Temps de repos critique',
        description: `Votre temps de repos est dangereusement bas (${stats.pourcentageRepos.toFixed(1)}%, minimum vital : 30%). Ce manque de repos peut entraîner de l'épuisement, une baisse de concentration, et des problèmes de santé. Vous devez impérativement libérer ${Math.ceil((30 - stats.pourcentageRepos) * stats.heuresTotales / 100)}h supplémentaires pour le repos et le sommeil.`,
        priorite: 'haute',
        actionSuggeree: `Libérer immédiatement ${Math.ceil((30 - stats.pourcentageRepos) * stats.heuresTotales / 100)}h pour le repos`,
      });
    } else if (stats.pourcentageRepos < 30) {
      recommandations.push({
        id: this.generateId(),
        type: 'repos',
        titre: 'Augmenter le temps de repos',
        description: `Votre temps de repos (${stats.pourcentageRepos.toFixed(1)}%) est en dessous du seuil recommandé de 30-35%. Pour maintenir une bonne santé mentale et physique, et optimiser vos performances académiques et professionnelles, visez au moins 7-8h de sommeil par nuit plus 2-3h de détente quotidienne.`,
        priorite: 'haute',
        actionSuggeree: `Libérer ${Math.ceil((30 - stats.pourcentageRepos) * stats.heuresTotales / 100)}h supplémentaires pour le repos`,
      });
    } else if (stats.pourcentageRepos >= 45) {
      recommandations.push({
        id: this.generateId(),
        type: 'optimisation',
        titre: 'Optimiser l\'utilisation du temps libre',
        description: `Vous disposez d'un excellent temps de repos (${stats.pourcentageRepos.toFixed(1)}%). Profitez de ce temps pour des activités enrichissantes : développement personnel, sport, loisirs créatifs, ou même augmenter légèrement vos heures de travail/études si vous souhaitez progresser plus rapidement sans compromettre votre équilibre.`,
        priorite: 'basse',
        actionSuggeree: `Exploiter ${Math.floor(stats.heuresRepos * 0.2)}h de temps libre pour des activités de développement`,
      });
    }

    // 4. ÉQUILIBRE TRAVAIL/ÉTUDES (Analyse contextuelle)
    const ratio = stats.heuresTravail / (stats.heuresEtudes || 1);
    
    if (ratio > 2.5) {
      recommandations.push({
        id: this.generateId(),
        type: 'etudes',
        titre: 'Déséquilibre critique : Trop de travail',
        description: `Votre ratio travail/études est très déséquilibré (${ratio.toFixed(1)}:1, avec ${stats.heuresTravail.toFixed(1)}h de travail vs ${stats.heuresEtudes.toFixed(1)}h d'études). Vos études risquent d'en pâtir. En tant qu'étudiant, la priorité doit rester vos cours et examens. Réduisez vos heures de travail ou optez pour un emploi plus flexible.`,
        priorite: 'haute',
        actionSuggeree: `Réduire les heures de travail de ${Math.ceil(stats.heuresTravail * 0.3)}h par semaine`,
      });
    } else if (ratio > 1.5) {
      recommandations.push({
        id: this.generateId(),
        type: 'etudes',
        titre: 'Rééquilibrer travail et études',
        description: `Vous consacrez ${stats.heuresTravail.toFixed(1)}h au travail contre ${stats.heuresEtudes.toFixed(1)}h aux études (ratio ${ratio.toFixed(1)}:1). L'équilibre idéal pour un étudiant est entre 0.6:1 et 1.2:1. Assurez-vous que votre travail ne nuit pas à vos résultats académiques, qui restent votre priorité principale.`,
        priorite: 'moyenne',
        actionSuggeree: `Réduire les heures de travail de 2-3h et augmenter le temps d'étude`,
      });
    } else if (ratio < 0.3 && stats.heuresTravail > 0) {
      recommandations.push({
        id: this.generateId(),
        type: 'travail',
        titre: 'Augmenter l\'expérience professionnelle',
        description: `Vous consacrez peu de temps au travail (${stats.heuresTravail.toFixed(1)}h) comparé à vos études (${stats.heuresEtudes.toFixed(1)}h). L'expérience professionnelle est précieuse pour votre développement de carrière. Si votre emploi du temps le permet, envisagez d'augmenter vos heures de travail de 3-5h pour développer vos compétences pratiques.`,
        priorite: 'basse',
        actionSuggeree: `Chercher des opportunités de travail/stage à temps partiel (5-10h/semaine)`,
      });
    } else if (ratio >= 0.6 && ratio <= 1.2) {
      recommandations.push({
        id: this.generateId(),
        type: 'optimisation',
        titre: 'Excellent équilibre travail/études !',
        description: `Votre répartition travail/études est exemplaire (${stats.heuresTravail.toFixed(1)}h de travail, ${stats.heuresEtudes.toFixed(1)}h d'études). Vous avez trouvé un bon équilibre entre développement académique et expérience professionnelle. Maintenez ce rythme en restant vigilant sur votre temps de repos.`,
        priorite: 'basse',
        actionSuggeree: `Continuer sur cette lancée et surveiller l'équilibre à long terme`,
      });
    }

    // 5. ACTIVITÉS PERSONNELLES (Développement holistique)
    if (stats.heuresActivites === 0) {
      recommandations.push({
        id: this.generateId(),
        type: 'bienetre',
        titre: 'Intégrer des activités personnelles',
        description: `Aucune activité personnelle n'est planifiée dans votre routine. Le développement personnel, les loisirs, le sport et les activités sociales sont essentiels pour votre équilibre mental, votre créativité et votre bien-être général. Réservez au moins 3-5h par semaine pour des activités qui vous passionnent.`,
        priorite: 'moyenne',
        actionSuggeree: `Bloquer 3-5h par semaine pour du sport, des hobbies ou des activités sociales`,
      });
    } else if (stats.heuresActivites < 3) {
      recommandations.push({
        id: this.generateId(),
        type: 'activites',
        titre: 'Augmenter les activités personnelles',
        description: `Vous consacrez ${stats.heuresActivites.toFixed(1)}h aux activités personnelles, ce qui est insuffisant pour un développement équilibré. Les activités personnelles (sport, loisirs, socialisation) améliorent votre santé mentale, votre créativité et vos performances dans les autres domaines. Visez au moins 5-7h par semaine.`,
        priorite: 'moyenne',
        actionSuggeree: `Augmenter les activités personnelles de ${Math.ceil(5 - stats.heuresActivites)}h par semaine`,
      });
    } else if (stats.heuresActivites >= 8) {
      recommandations.push({
        id: this.generateId(),
        type: 'activites',
        titre: 'Excellent temps pour vos activités !',
        description: `Vous consacrez ${stats.heuresActivites.toFixed(1)}h à vos activités personnelles, ce qui est excellent pour votre bien-être et votre développement personnel. Continuez à cultiver vos passions et vos relations sociales, elles sont essentielles pour votre épanouissement.`,
        priorite: 'basse',
        actionSuggeree: `Maintenir ce temps d'activités et varier les types d'activités`,
      });
    }

    // 6. SANTÉ ET BIEN-ÊTRE (Recommandations proactives)
    const totalHeuresEngagees = stats.heuresTravail + stats.heuresEtudes;
    if (totalHeuresEngagees > 50) {
      recommandations.push({
        id: this.generateId(),
        type: 'sante',
        titre: 'Attention au surmenage',
        description: `Vous cumulez ${totalHeuresEngagees.toFixed(1)}h d'activités engageantes par semaine (travail + études). Au-delà de 50h, le risque de burnout augmente significativement. Soyez attentif aux signes de fatigue : troubles du sommeil, irritabilité, baisse de motivation. Accordez-vous des pauses régulières et n'hésitez pas à réduire la charge si nécessaire.`,
        priorite: 'haute',
        actionSuggeree: `Surveiller les signes de fatigue et prévoir des moments de décompression`,
      });
    }

    if (stats.heuresActivites === 0 || stats.heuresActivites < 2) {
      recommandations.push({
        id: this.generateId(),
        type: 'sante',
        titre: 'Intégrer de l\'exercice physique',
        description: `L'activité physique est absente ou quasi-absente de votre routine. L'exercice régulier (même 30 min/jour) améliore la concentration, réduit le stress, améliore le sommeil et booste les performances académiques. Marche, jogging, sport collectif, ou simplement des étirements : trouvez ce qui vous convient.`,
        priorite: 'moyenne',
        actionSuggeree: `Planifier 3-4 sessions de 30-45 minutes d'exercice physique par semaine`,
      });
    }

    // 7. PRODUCTIVITÉ ET EFFICACITÉ (Conseils avancés)
    if (conflicts.length === 0 && overloadedDays.length === 0) {
      recommandations.push({
        id: this.generateId(),
        type: 'optimisation',
        titre: 'Planning bien organisé !',
        description: `Félicitations ! Votre emploi du temps est bien structuré sans conflits ni surcharges. Pour optimiser davantage : groupez les tâches similaires (ex: tous les cours le matin), utilisez la technique Pomodoro (25 min de travail, 5 min de pause), et réservez vos heures de meilleure énergie pour les tâches les plus exigeantes.`,
        priorite: 'basse',
        actionSuggeree: `Appliquer des techniques de productivité (Pomodoro, time-blocking)`,
      });
    }

    // 8. DÉVELOPPEMENT SOCIAL (Important pour étudiants)
    if (stats.heuresActivites < 5) {
      recommandations.push({
        id: this.generateId(),
        type: 'social',
        titre: 'Développer vos relations sociales',
        description: `Le temps consacré aux activités sociales semble limité. Les relations amicales et le réseau professionnel sont cruciaux pour votre épanouissement et votre future carrière. Rejoignez des clubs étudiants, participez à des événements, ou simplement passez du temps avec vos amis. Visez 3-5h d'activités sociales par semaine.`,
        priorite: 'moyenne',
        actionSuggeree: `Planifier 3h d'activités sociales (clubs, sorties, networking)`,
      });
    }

    // 9. ÉQUILIBRE À LONG TERME (Vision stratégique)
    const totalHeures = stats.heuresTotales;
    const utilization = ((stats.heuresTravail + stats.heuresEtudes + stats.heuresActivites) / totalHeures) * 100;
    
    if (utilization > 70) {
      recommandations.push({
        id: this.generateId(),
        type: 'bienetre',
        titre: 'Prévoir des périodes de décompression',
        description: `Votre taux d'occupation est de ${utilization.toFixed(1)}% (${(stats.heuresTravail + stats.heuresEtudes + stats.heuresActivites).toFixed(1)}h d'activités structurées). Un rythme aussi soutenu nécessite des périodes de décompression totale. Planifiez une demi-journée par semaine sans aucune obligation, pour la spontanéité et la récupération mentale.`,
        priorite: 'moyenne',
        actionSuggeree: `Bloquer une demi-journée par semaine complètement libre`,
      });
    } else if (utilization < 40) {
      recommandations.push({
        id: this.generateId(),
        type: 'optimisation',
        titre: 'Opportunité de développement',
        description: `Votre planning est sous-utilisé (${utilization.toFixed(1)}% d'occupation). Vous avez l'opportunité d'ajouter des activités enrichissantes : projets personnels, formations en ligne, bénévolat, networking, ou simplement explorer de nouveaux domaines qui vous intéressent. C'est le moment idéal pour investir en vous-même !`,
        priorite: 'basse',
        actionSuggeree: `Identifier 2-3 activités de développement personnel à intégrer`,
      });
    }

    // 10. GESTION DU STRESS (Prévention)
    if (conflicts.length >= 3 || overloadedDays.length >= 2) {
      recommandations.push({
        id: this.generateId(),
        type: 'bienetre',
        titre: 'Mettre en place des stratégies anti-stress',
        description: `Votre routine présente ${conflicts.length} conflits et ${overloadedDays.length} jour(s) surchargé(s), ce qui peut générer du stress. Adoptez des techniques de gestion du stress : méditation (10 min/jour), respiration profonde, journaling, ou simplement des pauses régulières. Ces pratiques amélioreront votre résilience et votre bien-être.`,
        priorite: 'moyenne',
        actionSuggeree: `Intégrer 10-15 minutes de méditation ou relaxation quotidienne`,
      });
    }

    // 11. NUTRITION ET PAUSES (Souvent négligé)
    const totalHeuresStructurees = stats.heuresTravail + stats.heuresEtudes;
    if (totalHeuresStructurees > 40) {
      recommandations.push({
        id: this.generateId(),
        type: 'sante',
        titre: 'Planifier des pauses repas adéquates',
        description: `Avec ${totalHeuresStructurees.toFixed(1)}h d'activités structurées, il est essentiel de planifier des pauses repas de qualité. Ne sautez pas de repas, prenez au moins 30 minutes pour déjeuner sans travailler. Une nutrition adéquate et des pauses régulières améliorent la concentration et l'énergie.`,
        priorite: 'moyenne',
        actionSuggeree: `Bloquer 45-60 minutes pour le déjeuner chaque jour`,
      });
    }

    // 12. FLEXIBILITÉ ET ADAPTATION (Conseil avancé)
    if (conflicts.length > 0 || overloadedDays.length > 0) {
      recommandations.push({
        id: this.generateId(),
        type: 'planning',
        titre: 'Prévoir des marges de flexibilité',
        description: `Votre planning actuel est serré avec peu de marge de manœuvre. Les imprévus (maladie, urgences, opportunités) sont inévitables. Intégrez des "tampons" de 1-2h par jour pour gérer les imprévus sans perturber tout votre emploi du temps. Cette flexibilité réduit le stress et améliore votre capacité d'adaptation.`,
        priorite: 'moyenne',
        actionSuggeree: `Réserver 1-2h de marge flexible chaque jour pour les imprévus`,
      });
    }

    // Limiter à 12 recommandations maximum, les plus pertinentes
    return recommandations.slice(0, 12);
  }

  /**
   * Génère des suggestions d'optimisation intelligentes et détaillées
   */
  private generateOptimizationSuggestions(
    stats: any,
    conflicts: ConflictDto[],
    overloadedDays: OverloadedDayDto[]
  ): any[] {
    const suggestions: any[] = [];

    // 1. Suggestions pour résoudre les conflits (détaillées)
    conflicts.forEach((conflict, index) => {
      if (index < 3) {
        const severity = conflict.severity;
        const timeframe = conflict.overlapDuration >= 60 ? `${Math.floor(conflict.overlapDuration / 60)}h${conflict.overlapDuration % 60}min` : `${conflict.overlapDuration}min`;
        
        let description = '';
        let avantage = '';
        
        if (severity === ConflictSeverity.CRITICAL) {
          description = `CONFLIT CRITIQUE le ${conflict.date} : "${conflict.event1.titre}" (${conflict.event1.heureDebut}-${conflict.event1.heureFin}) chevauche complètement "${conflict.event2.titre}" (${conflict.event2.heureDebut}-${conflict.event2.heureFin}). L'un des deux événements doit être déplacé ou annulé immédiatement.`;
          avantage = `Éliminer l'impossibilité physique d'honorer les deux engagements simultanément (${timeframe} de chevauchement)`;
        } else if (severity === ConflictSeverity.HIGH) {
          description = `Conflit majeur le ${conflict.date} : "${conflict.event1.titre}" et "${conflict.event2.titre}" se chevauchent de ${timeframe}. Vous devrez choisir entre les deux ou négocier un déplacement avec l'organisateur.`;
          avantage = `Éviter de manquer une partie importante de l'un des événements et réduire le stress`;
        } else {
          description = `Chevauchement partiel le ${conflict.date} entre "${conflict.event1.titre}" et "${conflict.event2.titre}" (${timeframe}). Prévoyez du temps pour la transition ou ajustez légèrement les horaires.`;
          avantage = `Éviter les retards et la précipitation, améliorer la qualité de participation`;
        }
        
        suggestions.push({
          id: this.generateId(),
          jour: conflict.date,
          type: 'deplacement',
          description,
          avantage,
          impact: severity === ConflictSeverity.CRITICAL ? 'tresPositif' : severity === ConflictSeverity.HIGH ? 'tresPositif' : 'positif',
        });
      }
    });

    // 2. Suggestions pour alléger les jours surchargés (stratégiques)
    overloadedDays.forEach((day, index) => {
      if (index < 2) {
        const excessHours = day.totalHours - 10;
        const eventsByType = day.evenements.reduce((acc, e) => {
          acc[e.type] = (acc[e.type] || 0) + 1;
          return acc;
        }, {} as any);
        
        let strategie = '';
        if (eventsByType['job'] && eventsByType['cours']) {
          strategie = `Vous avez à la fois des cours et du travail ce jour-là. Envisagez de déplacer ${Math.ceil(excessHours)}h de travail vers un jour plus léger.`;
        } else if (day.evenements.length >= 4) {
          strategie = `Avec ${day.evenements.length} événements ce jour-là, regroupez ou éliminez les activités moins prioritaires.`;
        } else {
          strategie = `Réduisez la durée de certaines activités ou déplacez ${Math.ceil(excessHours)}h vers d'autres jours.`;
        }
        
        suggestions.push({
          id: this.generateId(),
          jour: day.jour,
          type: 'reorganisation',
          description: `${day.jour} est surchargé (${day.totalHours.toFixed(1)}h, soit ${excessHours.toFixed(1)}h au-dessus de la charge optimale). ${strategie} Une meilleure répartition hebdomadaire améliore l'efficacité et réduit la fatigue.`,
          avantage: `Réduire la fatigue de ${day.level === 'critique' ? '40-50%' : '20-30%'}, améliorer la concentration et la qualité du travail`,
          impact: 'tresPositif',
        });
      }
    });

    // 3. Suggestions de regroupement (Time-blocking)
    if (conflicts.length === 0 && suggestions.length < 3) {
      suggestions.push({
        id: this.generateId(),
        jour: 'Cette semaine',
        type: 'regroupement',
        description: `Optimisez votre emploi du temps en regroupant les activités similaires. Par exemple : tous les cours le matin (meilleure concentration), travail l'après-midi, activités personnelles en soirée. Cette organisation par "blocs" réduit la fragmentation mentale et améliore la productivité.`,
        avantage: `Augmentation de 25-30% de la productivité grâce à la réduction du "context switching"`,
        impact: 'tresPositif',
      });
    }

    // 4. Suggestions de pauses stratégiques
    if (stats.heuresTravail + stats.heuresEtudes > 30) {
      suggestions.push({
        id: this.generateId(),
        jour: 'Tous les jours',
        type: 'pause',
        description: `Avec ${(stats.heuresTravail + stats.heuresEtudes).toFixed(1)}h d'activités intensives par semaine, intégrez des micro-pauses de 5-10 minutes toutes les heures. Utilisez la règle 50/10 : 50 minutes de travail concentré, 10 minutes de pause. Levez-vous, marchez, hydratez-vous.`,
        avantage: `Maintenir un haut niveau de concentration toute la journée, réduire la fatigue oculaire et musculaire`,
        impact: 'positif',
      });
    }

    // 5. Suggestions d'optimisation du sommeil
    if (stats.pourcentageRepos < 35) {
      suggestions.push({
        id: this.generateId(),
        jour: 'Tous les soirs',
        type: 'ajout',
        description: `Votre temps de repos (${stats.pourcentageRepos.toFixed(1)}%) suggère un manque de sommeil. Établissez une routine de coucher régulière : même heure chaque soir, 30 min de "wind-down" sans écrans, température fraîche dans la chambre. Visez 7-8h de sommeil par nuit pour une récupération optimale.`,
        avantage: `Amélioration de 30-40% de la concentration, de la mémoire et de la capacité d'apprentissage`,
        impact: 'tresPositif',
      });
    }

    // 6. Suggestions de productivité hebdomadaire
    if (overloadedDays.length === 0 && conflicts.length === 0) {
      suggestions.push({
        id: this.generateId(),
        jour: 'Dimanche soir',
        type: 'planification',
        description: `Votre routine est bien équilibrée ! Pour la maintenir, consacrez 15-20 minutes chaque dimanche soir à planifier la semaine : identifier les priorités, anticiper les défis, préparer le matériel nécessaire. Cette revue hebdomadaire réduit le stress et améliore le sentiment de contrôle.`,
        avantage: `Commencer chaque semaine avec clarté et confiance, réduire l'anxiété de 40-50%`,
        impact: 'positif',
      });
    }

    // 7. Suggestions basées sur le ratio travail/études
    const ratio = stats.heuresTravail / (stats.heuresEtudes || 1);
    if (ratio > 2 && stats.heuresTravail > 20) {
      suggestions.push({
        id: this.generateId(),
        jour: 'Cette semaine',
        type: 'reduction',
        description: `Votre charge de travail (${stats.heuresTravail.toFixed(1)}h) dépasse largement vos heures d'études (${stats.heuresEtudes.toFixed(1)}h). Discutez avec votre employeur pour réduire à 15-20h/semaine maximum pendant les périodes d'examens. Votre succès académique doit rester la priorité.`,
        avantage: `Améliorer vos résultats académiques sans sacrifier l'expérience professionnelle`,
        impact: 'tresPositif',
      });
    }

    // Limiter à 8 suggestions maximum, les plus impactantes
    return suggestions.slice(0, 8);
  }

  /**
   * Génère des recommandations par défaut (sans IA)
   */
  private generateDefaultRecommendations(
    stats: any,
    conflicts: ConflictDto[],
    overloadedDays: OverloadedDayDto[]
  ): any {
    return {
      recommandations: this.generateDataBasedRecommendations(stats, conflicts, overloadedDays),
      suggestionsOptimisation: this.generateOptimizationSuggestions(stats, conflicts, overloadedDays),
    };
  }
}

