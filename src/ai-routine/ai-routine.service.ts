import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import type { Cache } from 'cache-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash } from 'crypto';
import { RoutineInputDataDto } from './dto/routine-input.dto';

@Injectable()
export class AIRoutineService {
  private readonly logger = new Logger(AIRoutineService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    // Initialisation paresseuse de Gemini (lazy initialization)
    // L'initialisation se fera lors du premier appel à analyzeRoutine
  }

  private initializeGemini(): void {
    if (this.genAI && this.model) {
      return; // Déjà initialisé
    }

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY non définie dans les variables d\'environnement');
      this.logger.error('Vérifiez que le fichier .env (ou .env.production) existe et contient GEMINI_API_KEY');
      throw new Error('GEMINI_API_KEY est requise. Veuillez l\'ajouter dans votre fichier .env ou .env.production');
    }

    // Vérifier si c'est encore le placeholder
    if (apiKey === 'votre_cle_api_ici' || apiKey.includes('XXXXXXXXXXXXXXXX')) {
      this.logger.error('GEMINI_API_KEY contient encore le placeholder');
      this.logger.error('Remplacez "votre_cle_api_ici" par votre vraie clé API Gemini');
      this.logger.error('Obtenez votre clé sur: https://makersuite.google.com/app/apikey');
      throw new Error('GEMINI_API_KEY doit être remplacée par votre vraie clé API. Obtenez-la sur https://makersuite.google.com/app/apikey');
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
    let modelName = modelsToTry[0];
    
    this.model = this.genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

    this.logger.log(`✅ Google Gemini ${modelName} initialisé avec succès`);
  }

  async analyzeRoutine(
    userId: string,
    data: RoutineInputDataDto,
  ): Promise<any> {
    // Initialiser Gemini si ce n'est pas déjà fait
    this.initializeGemini();

    // 1. Générer un hash des données pour le cache
    const dataHash = this.generateDataHash(data);
    const cacheKey = `routine_analysis_${userId}_${dataHash}`;

    // 2. Vérifier le cache
    try {
      const cached = await this.cacheManager.get<any>(cacheKey);
      if (cached) {
        this.logger.log(`✅ Cache hit pour utilisateur ${userId}`);
        return cached;
      }
    } catch (error) {
      this.logger.warn('Erreur lors de la lecture du cache, continuation sans cache');
    }

    this.logger.log(`❌ Cache miss pour utilisateur ${userId}, appel Gemini...`);

    // 3. Calculer les statistiques
    const stats = this.calculateStats(data);

    // 4. Créer le prompt
    const prompt = this.createPrompt(data, stats);

    try {
      // 5. Appeler Gemini avec fallback sur d'autres modèles si nécessaire
      let result;
      let response;
      let text;
      
      try {
        result = await this.model.generateContent(prompt);
        response = await result.response;
        text = response.text();
      } catch (modelError: any) {
        // Si erreur 404 (modèle non trouvé), essayer d'autres modèles
        if (modelError.status === 404 || modelError.message?.includes('404') || modelError.message?.includes('not found')) {
          this.logger.warn('Modèle initial non disponible, tentative avec d\'autres modèles...');
          
          if (!this.genAI) {
            throw new Error('GoogleGenerativeAI n\'est pas initialisé');
          }
          
          const modelsToTry = [
            'gemini-1.5-flash-latest',
            'gemini-1.5-pro-latest',
            'gemini-pro',
            'gemini-1.5-flash',
            'gemini-1.5-pro'
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
                  maxOutputTokens: 2048,
                },
              });
              
              result = await fallbackModel.generateContent(prompt);
              response = await result.response;
              text = response.text();
              
              // Mettre à jour le modèle pour les prochaines utilisations
              this.model = fallbackModel;
              this.logger.log(`✅ Modèle ${modelName} fonctionne, utilisation de ce modèle`);
              success = true;
              break;
            } catch (fallbackError) {
              this.logger.warn(`Modèle ${modelName} non disponible: ${fallbackError.message}`);
              continue;
            }
          }
          
          if (!success) {
            throw new Error('Aucun modèle Gemini disponible. Vérifiez votre clé API et les modèles accessibles.');
          }
        } else {
          throw modelError;
        }
      }

      // 6. Parser la réponse JSON
      let aiResponse;
      try {
        // Extraire le JSON de la réponse (peut contenir du markdown)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Aucun JSON trouvé dans la réponse');
        }
      } catch (parseError) {
        this.logger.error('Erreur lors du parsing JSON:', parseError);
        this.logger.error('Réponse Gemini:', text);
        throw new Error('Erreur lors du parsing de la réponse Gemini');
      }

      // 7. Convertir en format RoutineBalance
      const routineBalance = this.convertToRoutineBalance(aiResponse, stats);

      // 8. Mettre en cache
      try {
        await this.cacheManager.set(cacheKey, routineBalance, 3600);
      } catch (cacheError) {
        this.logger.warn('Erreur lors de la mise en cache, continuation sans cache');
      }

      this.logger.log(`✅ Analyse terminée pour utilisateur ${userId}, score: ${routineBalance.scoreEquilibre}`);
      return routineBalance;

    } catch (error) {
      this.logger.error('Erreur lors de l\'appel Gemini:', error);
      throw new Error(`Erreur lors de l'analyse IA: ${error.message}`);
    }
  }

  private generateDataHash(data: RoutineInputDataDto): string {
    // Créer un hash des données pour identifier les analyses identiques
    const dataString = JSON.stringify({
      evenements: data.evenements.map(e => ({
        date: e.date,
        type: e.type,
        heureDebut: e.heureDebut,
        heureFin: e.heureFin,
      })),
      disponibilites: data.disponibilites,
      preferences: data.preferences,
      dateDebut: data.dateDebut,
      dateFin: data.dateFin,
    });
    
    return createHash('sha256')
      .update(dataString)
      .digest('hex')
      .substring(0, 16);
  }

  private calculateStats(data: RoutineInputDataDto): any {
    // Filtrer les événements dans la plage de dates
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
      const duree = this.calculerDureeHeures(
        evenement.heureDebut,
        evenement.heureFin
      );

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

    const heuresTotales = heuresTravail + heuresEtudes + heuresActivites;
    
    // Calculer le nombre de jours dans la période (inclusif)
    const diffTime = dateFin.getTime() - dateDebut.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 pour inclure le jour de fin
    const nombreJours = Math.max(1, diffDays); // Au moins 1 jour
    
    // Calculer les heures disponibles pour cette période (16h par jour)
    const heuresDisponibles = 16.0 * nombreJours;
    const heuresRepos = Math.max(0, heuresDisponibles - heuresTotales);
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

  private createPrompt(data: RoutineInputDataDto, stats: any): string {
    // Analyser les événements par jour pour identifier les patterns
    const evenementsParJour: { [key: string]: any[] } = {};
    const heuresParJour: { [key: string]: { travail: number; etudes: number; activites: number } } = {};
    
    data.evenements.forEach(evenement => {
      const date = new Date(evenement.date);
      const jourSemaine = date.toLocaleDateString('fr-FR', { weekday: 'long' });
      const dateStr = `${jourSemaine} ${evenement.date}`;
      
      if (!evenementsParJour[dateStr]) {
        evenementsParJour[dateStr] = [];
        heuresParJour[dateStr] = { travail: 0, etudes: 0, activites: 0 };
      }
      
      evenementsParJour[dateStr].push(evenement);
      
      const duree = this.calculerDureeHeures(evenement.heureDebut, evenement.heureFin);
      const type = evenement.type.toLowerCase();
      
      if (type === 'job') {
        heuresParJour[dateStr].travail += duree;
      } else if (type === 'cours') {
        heuresParJour[dateStr].etudes += duree;
      } else {
        heuresParJour[dateStr].activites += duree;
      }
    });

    // Construire le texte des événements avec analyse par jour
    let evenementsText = '';
    if (data.evenements.length > 0) {
      evenementsText = Object.keys(evenementsParJour).map(dateStr => {
        const evenements = evenementsParJour[dateStr];
        const heures = heuresParJour[dateStr];
        const totalHeures = heures.travail + heures.etudes + heures.activites;
        
        const evenementsList = evenements.map(e => 
          `  • ${e.titre} (${e.type}) : ${e.heureDebut} - ${e.heureFin}${e.lieu ? ` @ ${e.lieu}` : ''}`
        ).join('\n');
        
        return `${dateStr} (${totalHeures.toFixed(1)}h total : ${heures.travail.toFixed(1)}h travail, ${heures.etudes.toFixed(1)}h études, ${heures.activites.toFixed(1)}h activités) :\n${evenementsList}`;
      }).join('\n\n');
    } else {
      evenementsText = 'Aucun événement';
    }

    // Identifier les jours surchargés
    const joursSurcharges = Object.keys(heuresParJour)
      .filter(dateStr => {
        const total = heuresParJour[dateStr].travail + heuresParJour[dateStr].etudes + heuresParJour[dateStr].activites;
        return total > 10; // Plus de 10h d'activités = surchargé
      })
      .map(dateStr => {
        const total = heuresParJour[dateStr].travail + heuresParJour[dateStr].etudes + heuresParJour[dateStr].activites;
        return `${dateStr} (${total.toFixed(1)}h)`;
      });

    const disponibilitesText = data.disponibilites.length > 0
      ? data.disponibilites.map(d => 
          `- ${d.jour} : ${d.heureDebut}${d.heureFin ? ` - ${d.heureFin}` : ' (toute la journée)'}`
        ).join('\n')
      : 'Aucune disponibilité définie';

    return `Tu es un assistant IA expert en équilibre vie-études-travail pour les étudiants tunisiens.

Analyse cette routine hebdomadaire en PROFONDEUR et génère des recommandations COMPLÈTES et VARIÉES.

STATISTIQUES GLOBALES DE LA PÉRIODE :

- Heures de travail : ${stats.heuresTravail.toFixed(1)}h (${stats.pourcentageTravail.toFixed(1)}%)
- Heures d'études : ${stats.heuresEtudes.toFixed(1)}h (${stats.pourcentageEtudes.toFixed(1)}%)
- Heures de repos : ${stats.heuresRepos.toFixed(1)}h (${stats.pourcentageRepos.toFixed(1)}%)
- Heures d'activités personnelles : ${stats.heuresActivites.toFixed(1)}h (${stats.pourcentageActivites.toFixed(1)}%)
- Heures totales d'activités : ${stats.heuresTotales.toFixed(1)}h

ÉVÉNEMENTS DÉTAILLÉS PAR JOUR :

${evenementsText}

${joursSurcharges.length > 0 ? `⚠️ JOURS SURCHARGÉS DÉTECTÉS (>10h d'activités) :
${joursSurcharges.map(j => `- ${j}`).join('\n')}

` : ''}DISPONIBILITÉS :

${disponibilitesText}

${data.preferences ? `PRÉFÉRENCES UTILISATEUR :

- Niveau d'étude : ${data.preferences.educationLevel || 'Non spécifié'}

- Domaine : ${data.preferences.studyField || 'Non spécifié'}

- Motivation : ${data.preferences.mainMotivation || 'Non spécifiée'}

` : ''}

Génère une analyse complète et approfondie en JSON avec ce format EXACT (réponds UNIQUEMENT en JSON, sans texte avant ou après) :

{
  "scoreEquilibre": 0-100,
  "recommandations": [
    {
      "type": "travail|etudes|repos|activites|sante|social|optimisation|planning|bienetre",
      "titre": "Titre court et clair",
      "description": "Description détaillée et personnalisée (2-4 phrases)",
      "priorite": "haute|moyenne|basse",
      "actionSuggeree": "Action concrète et réalisable"
    }
  ],
  "suggestionsOptimisation": [
    {
      "jour": "Jour concerné ou 'Cette semaine'",
      "type": "deplacement|ajout|suppression|regroupement|pause|reorganisation",
      "description": "Description détaillée de l'optimisation",
      "avantage": "Avantage concret et mesurable",
      "impact": "tresPositif|positif|neutre"
    }
  ]
}

RÈGLES CRITIQUES - À RESPECTER IMPÉRATIVEMENT :

1. RECOMMANDATIONS (OBLIGATOIRE : 8-12 recommandations minimum) :
   - GÉNÈRE AU MINIMUM 8-12 RECOMMANDATIONS VARIÉES couvrant TOUS ces aspects :
     * Équilibre travail/études (ratio, répartition, proportionnalité)
     * Charge de travail (heures totales, jours surchargés, pic d'activité)
     * Temps de repos et sommeil (qualité, quantité, régularité)
     * Activités personnelles et sociales (développement personnel, loisirs, relations)
     * Santé et bien-être (exercice, nutrition, gestion du stress)
     * Optimisation du planning (répartition, chevauchements, transitions)
     * Préférences utilisateur (si disponibles dans les données)
     * Suggestions spécifiques basées sur les événements réels analysés
   
   - Sois CRÉATIF et propose des solutions INNOVANTES adaptées au profil de l'étudiant
   - Identifie les PROBLÈMES SPÉCIFIQUES, les PATTERNS, les OPPORTUNITÉS d'amélioration
   - Analyse en PROFONDEUR chaque aspect de la routine

2. SUGGESTIONS D'OPTIMISATION (OBLIGATOIRE : 3-5 suggestions minimum) :
   - Minimum 3-5 suggestions d'optimisation CONCRÈTES et ACTIONNABLES
   - Chaque suggestion doit être spécifique à un jour ou à la semaine
   - Propose des changements précis : déplacement d'événements, ajout de pauses, regroupement d'activités
   - Explique clairement l'avantage et l'impact de chaque optimisation

3. ANALYSE APPROFONDIE :
   - Identifie les problèmes spécifiques dans la routine actuelle
   - Détecte les patterns (ex: surcharge certains jours, manque d'activités autres jours)
   - Trouve les opportunités d'amélioration concrètes
   - Sois spécifique : mentionne les jours, les heures, les types d'événements concernés

4. ADAPTATION :
   - Sois spécifique et adapté au contexte tunisien (horaires, culture, système éducatif)
   - Les recommandations doivent être pratiques et réalisables
   - Le score doit refléter l'équilibre réel (0-100) en tenant compte de tous les facteurs

5. FORMAT :
   - Réponds UNIQUEMENT en JSON valide, sans markdown, sans code blocks
   - Pas de texte avant ou après le JSON
   - Structure exacte respectée

EXEMPLE DE RECOMMANDATIONS VARIÉES À GÉNÉRER :
- "Optimiser la répartition travail/études : ratio actuel X/Y, idéal serait..."
- "Jour surchargé détecté : [jour] avec X heures, suggérer..."
- "Manque de temps de repos : seulement Xh de repos, recommandation..."
- "Absence d'activités personnelles : ajouter des moments pour..."
- "Santé : pas d'exercice prévu, suggérer..."
- "Optimisation planning : regrouper les cours du matin pour..."
- "Gestion du stress : pic d'activité le [jour], proposer..."
- "Développement social : manque d'interactions, suggérer..."
- Etc. (minimum 8-12 recommandations au total)`;
  }

  private convertToRoutineBalance(aiResponse: any, stats: any): any {
    // Générer des IDs uniques
    const generateId = () => Math.random().toString(36).substring(2, 15);

    return {
      id: generateId(),
      dateAnalyse: new Date().toISOString(),
      scoreEquilibre: Math.max(0, Math.min(100, aiResponse.scoreEquilibre || 50)),
      recommandations: (aiResponse.recommandations || []).map((r: any) => ({
        id: generateId(),
        type: r.type || 'optimisation',
        titre: r.titre || 'Recommandation',
        description: r.description || '',
        priorite: r.priorite || 'moyenne',
        actionSuggeree: r.actionSuggeree || null,
      })),
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
      suggestionsOptimisation: (aiResponse.suggestionsOptimisation || []).map((s: any) => ({
        id: generateId(),
        jour: s.jour || 'Cette semaine',
        type: s.type || 'optimisation',
        description: s.description || '',
        avantage: s.avantage || '',
        impact: s.impact || 'neutre',
      })),
    };
  }
}

