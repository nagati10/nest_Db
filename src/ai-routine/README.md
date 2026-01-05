# 🤖 Module AI-Routine V2.0

## Vue d'ensemble

Le module **AI-Routine** analyse l'emploi du temps des étudiants et génère des recommandations intelligentes pour optimiser leur équilibre vie-études-travail.

### ✨ Fonctionnalités Principales

- ✅ **Détection automatique des conflits** d'horaires
- ✅ **Identification des jours surchargés** (>10h d'activités)
- ✅ **Calcul précis du score d'équilibre** avec décomposition
- ✅ **Analyse de compatibilité** avec les offres d'emploi
- ✅ **Suggestions en temps réel** lors de l'ajout d'événements
- ✅ **Calcul des créneaux disponibles**
- ✅ **Recommandations IA personnalisées** via Google Gemini

---

## 🚀 Démarrage Rapide

### Installation
```bash
# Les dépendances sont déjà installées
npm install
```

### Configuration
```bash
# Ajoutez dans votre .env
GEMINI_API_KEY=votre_cle_api_gemini
MONGODB_URI=votre_uri_mongodb
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Utilisation
```bash
# Démarrer l'application
npm run start:dev

# Tester le service
curl http://localhost:3005/ai/routine/health
```

---

## 📡 Endpoints API

### 1. Analyse Complète (Recommandé)
```
POST /ai/routine/analyze-enhanced
```

**Fonctionnalités :**
- Détection automatique des conflits
- Identification des jours surchargés
- Calcul des créneaux disponibles
- Score d'équilibre avec décomposition
- Recommandations IA personnalisées

**Exemple :**
```json
{
  "evenements": [...],
  "disponibilites": [...],
  "dateDebut": "2024-01-15",
  "dateFin": "2024-01-21"
}
```

### 2. Compatibilité avec Offre
```
POST /ai/routine/check-job-compatibility
```

**Fonctionnalités :**
- Score de compatibilité (0-100)
- Heures disponibles calculées
- Meilleurs créneaux suggérés
- Impact sur l'équilibre
- Recommandation finale

### 3. Suggestion Rapide
```
POST /ai/routine/quick-suggestion
```

**Fonctionnalités :**
- Analyse instantanée (<500ms)
- Détection de conflits avant ajout
- Suggestions d'alternatives
- 3 statuts : OK, WARNING, ERROR

### 4. Health Check
```
GET /ai/routine/health
```

---

## 📁 Structure du Module

```
src/ai-routine/
├── dto/
│   ├── routine-input.dto.ts          # DTOs d'entrée
│   ├── conflict.dto.ts                # Types pour conflits
│   ├── job-compatibility.dto.ts       # Types compatibilité
│   └── routine-response.dto.ts        # Types réponse
├── schemas/
│   └── routine-history.schema.ts      # Historique analyses
├── ai-routine.controller.ts           # Endpoints REST
├── ai-routine.service.ts              # Service V1 (original)
├── ai-routine-enhanced.service.ts     # Service V2 (amélioré)
├── ai-routine.module.ts               # Module NestJS
└── README.md                          # Ce fichier
```

---

## 🧮 Algorithmes

### Détection des Conflits
```typescript
// Pour chaque paire d'événements du même jour
for (event1, event2 in sameDay) {
  overlap = calculateTimeOverlap(event1, event2);
  if (overlap > 0) {
    severity = calculateSeverity(overlap);
    conflicts.push({ event1, event2, severity, overlap });
  }
}
```

**Niveaux de gravité :**
- **CRITICAL** : Chevauchement total
- **HIGH** : Chevauchement > 60 min
- **MEDIUM** : Chevauchement 30-60 min
- **LOW** : Chevauchement < 30 min

### Calcul du Score d'Équilibre
```typescript
Score Final = 100 (base)
  + workStudyBalance    (-15 à +10)  // Ratio travail/études
  + restPenalty         (-30 à 0)    // Temps de repos
  + conflictPenalty     (variable)   // Conflits d'horaires
  + overloadPenalty     (variable)   // Jours surchargés
  + bonuses             (0 à +20)    // Bonus divers
```

### Calcul des Créneaux Disponibles
```typescript
// Pour chaque jour de disponibilité
1. Récupérer les événements de ce jour
2. Trier les événements par heure de début
3. Identifier les créneaux libres entre événements
4. Filtrer les créneaux < 30 minutes
5. Retourner triés par durée décroissante
```

---

## 🎯 Cas d'Usage

### Cas 1 : Analyse de Routine
```typescript
const analysis = await analyzeRoutineEnhanced(userId, data);

console.log(`Score: ${analysis.scoreEquilibre}/100`);
console.log(`Conflits: ${analysis.conflicts.length}`);
console.log(`Jours surchargés: ${analysis.overloadedDays.length}`);
console.log(`Créneaux disponibles: ${analysis.availableTimeSlots.length}`);
```

### Cas 2 : Vérification avant Ajout
```typescript
const suggestion = await getQuickSuggestion(userId, newEvent, currentEvents);

if (suggestion.status === 'error') {
  alert('Conflit détecté !');
  showAlternatives(suggestion.alternatives);
} else {
  addEventToCalendar(newEvent);
}
```

### Cas 3 : Compatibilité avec Job
```typescript
const compatibility = await analyzeJobCompatibility(userId, offreId, routineData);

if (compatibility.available && compatibility.score >= 70) {
  showJobDetails(offre);
  showAvailableSlots(compatibility.bestTimeSlots);
} else {
  showWarnings(compatibility.warnings);
}
```

---

## 📊 Interprétation des Résultats

### Score d'Équilibre
- **90-100** : Excellent ⭐⭐⭐⭐⭐
- **80-89** : Très bon ⭐⭐⭐⭐
- **70-79** : Bon ⭐⭐⭐
- **60-69** : Moyen ⭐⭐
- **40-59** : Faible ⭐
- **0-39** : Critique ⚠️

### Health Summary
```typescript
{
  status: 'excellent' | 'bon' | 'moyen' | 'faible' | 'critique',
  mainIssues: string[],      // Problèmes identifiés
  mainStrengths: string[]     // Points forts
}
```

---

## 🔧 Configuration Avancée

### Seuils Personnalisables
```typescript
// Dans ai-routine-enhanced.service.ts

// Seuil de surcharge journalière
const OVERLOAD_THRESHOLD = 10;      // heures
const CRITICAL_THRESHOLD = 14;      // heures

// Durée minimale des créneaux
const MIN_SLOT_DURATION = 30;       // minutes

// Heures disponibles par jour
const AVAILABLE_HOURS_PER_DAY = 16; // heures
```

### Cache Redis
```typescript
// Dans ai-routine.module.ts
CacheModule.registerAsync({
  useFactory: async (configService: ConfigService) => ({
    store: redisStore,
    host: configService.get('REDIS_HOST', 'localhost'),
    port: configService.get('REDIS_PORT', 6379),
    ttl: 3600, // 1 heure
  }),
})
```

---

## 🧪 Tests

### Test Manuel avec curl
```bash
# 1. Login
curl -X POST http://localhost:3005/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 2. Analyser
curl -X POST http://localhost:3005/ai/routine/analyze-enhanced \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-data.json
```

### Test avec Swagger
```
http://localhost:3005/api
```

---

## 📚 Documentation Complète

### Pour Démarrer
- **DEMARRAGE_RAPIDE_AI_ROUTINE_V2.md** - Guide de démarrage (5 min)

### Pour Utiliser
- **GUIDE_UTILISATION_AI_ROUTINE_V2.md** - Guide complet d'utilisation
- Exemples d'appels API
- Intégration React Native
- Composants UI suggérés

### Pour Comprendre
- **AMELIORATIONS_AI_ROUTINE.md** - Architecture et algorithmes
- **CHANGELOG_AI_ROUTINE_V2.md** - Liste des changements V1→V2

### Pour Suivre
- **RESUME_IMPLEMENTATION_AI_ROUTINE_V2.md** - État d'avancement

---

## 🐛 Dépannage

### Problème : "GEMINI_API_KEY non définie"
```bash
# Vérifier
cat .env | grep GEMINI_API_KEY

# Ajouter
echo "GEMINI_API_KEY=votre_cle" >> .env

# Redémarrer
npm run start:dev
```

### Problème : Pas de conflits détectés
- Vérifiez le format des heures : "HH:MM" (ex: "09:00")
- Vérifiez le format des dates : "YYYY-MM-DD" (ex: "2024-01-15")
- Assurez-vous que les événements sont le même jour

### Problème : Score toujours à 50
- Ajoutez plus d'événements (minimum 3)
- Ajoutez plus de disponibilités (minimum 2)
- Période d'analyse d'au moins 7 jours

---

## 📈 Performance

### Temps de Réponse
- **Analyse complète** : 3-5 secondes (avec Gemini)
- **Suggestion rapide** : <500ms (sans IA)
- **Compatibilité job** : <1 seconde

### Optimisations
- Cache Redis (1 heure)
- Calculs locaux pour conflits
- Algorithmes optimisés (O(n²))
- Appel Gemini uniquement pour recommandations textuelles

---

## 🔜 Roadmap

### V2.1 (Prochainement)
- [ ] Historique des analyses
- [ ] Notifications intelligentes
- [ ] Graphiques d'évolution
- [ ] Comparaison avec autres étudiants

### V2.2 (Futur)
- [ ] Synchronisation Google Calendar
- [ ] Export PDF du planning
- [ ] Gamification (badges, points)
- [ ] IA personnalisée par profil

---

## 🤝 Contribution

### Structure du Code
- **Services** : Logique métier
- **Controllers** : Endpoints REST
- **DTOs** : Validation des données
- **Schemas** : Modèles MongoDB

### Conventions
- TypeScript strict
- Commentaires en français
- Documentation inline
- Tests unitaires recommandés

---

## 📞 Support

### Logs Utiles
```bash
# Démarrer en mode développement
npm run start:dev

# Logs à surveiller
✅ Google Gemini initialisé avec succès
🔍 X conflit(s) détecté(s)
⚠️ X jour(s) surchargé(s)
✅ X créneau(x) disponible(s)
📊 Score d'équilibre: X/100
```

### Endpoints de Diagnostic
```
GET /ai/routine/health  # État du service
```

---

**Version :** 2.0.0  
**Dernière mise à jour :** Décembre 2024  
**Équipe :** Talleb 5edma

🚀 **Prêt pour la production !**

