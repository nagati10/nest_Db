# 📖 Guide d'Intégration - Modules IA et Schedule

Documentation complète pour intégrer les modules **AI Routine**, **AI Matching**, **Schedule** et autres fonctionnalités dans votre backend NestJS existant.

---

## 🎯 Vue d'ensemble

Ce guide vous permet d'ajouter les fonctionnalités suivantes à votre backend :

- ✅ **AI Routine** - Analyse d'équilibre vie-études-travail avec Google Gemini
- ✅ **AI Matching** - Matching intelligent offres/étudiants avec Hugging Face
- ✅ **Schedule** - Traitement OCR d'emploi du temps (PDF → Événements)
- ✅ **Evenement** - Gestion des événements calendrier

---

## 📚 Documentation disponible

### 1. **DOCUMENTATION_INTEGRATION.md** (Complet)
   - Guide détaillé avec toutes les étapes
   - Explications techniques approfondies
   - Section dépannage complète
   - **👉 Commencez ici si vous voulez tout comprendre**

### 2. **GUIDE_MIGRATION_RAPIDE.md** (Express)
   - Guide simplifié en 5 minutes
   - Étapes essentielles uniquement
   - **👉 Utilisez celui-ci pour une installation rapide**

### 3. **COMMANDES_INSTALLATION.sh** (Automatique)
   - Script bash d'installation automatique
   - Vérifie et installe tout automatiquement
   - **👉 Exécutez ce script pour une installation guidée**

---

## ⚡ Démarrage rapide (3 options)

### Option 1 : Installation automatique (Recommandé)

```bash
# 1. Copiez le script dans votre backend
cp COMMANDES_INSTALLATION.sh /chemin/vers/votre/backend/

# 2. Exécutez le script
cd /chemin/vers/votre/backend
chmod +x COMMANDES_INSTALLATION.sh
./COMMANDES_INSTALLATION.sh

# 3. Suivez les instructions affichées
```

### Option 2 : Installation manuelle rapide

Suivez le guide : **GUIDE_MIGRATION_RAPIDE.md**

### Option 3 : Installation détaillée

Suivez le guide : **DOCUMENTATION_INTEGRATION.md**

---

## 📋 Prérequis

- ✅ Node.js 18+
- ✅ MongoDB (local ou Atlas)
- ✅ Backend NestJS existant
- ✅ npm ou yarn

---

## 🔑 Clés API nécessaires

### Obligatoire

- **GEMINI_API_KEY** (pour AI Routine)
  - Obtenez-la gratuitement : https://makersuite.google.com/app/apikey

### Optionnel

- **HF_API_KEY** (pour AI Matching - recommandations IA)
  - Obtenez-la gratuitement : https://huggingface.co/settings/tokens
  - Sans cette clé, le matching fonctionne mais avec des recommandations basiques

---

## 🛠️ Dépendances système

### GraphicsMagick (requis pour Schedule)

**macOS :**
```bash
brew install graphicsmagick
```

**Linux :**
```bash
sudo apt-get update && sudo apt-get install graphicsmagick
```

---

## 📦 Dépendances npm

```bash
npm install @google/generative-ai@^0.24.1 \
            @huggingface/inference@^4.13.4 \
            @nestjs/cache-manager@^3.0.1 \
            pdf-lib@^1.17.1 \
            pdf2pic@^3.1.2 \
            sharp@^0.33.0 \
            tesseract.js@^6.0.1 \
            cache-manager-redis-store@^3.0.1
```

---

## 📁 Modules à copier

Copiez ces dossiers depuis ce projet vers votre backend :

```
src/
├── ai-routine/          # Module AI Routine
├── ai-matching/          # Module AI Matching
├── schedule/             # Module Schedule (OCR)
└── evenement/            # Module Evenement (si pas déjà présent)
```

---

## 🔗 Intégration dans app.module.ts

```typescript
import { AIRoutineModule } from './ai-routine/ai-routine.module';
import { AiMatchingModule } from './ai-matching/ai-matching.module';
import { ScheduleModule } from './schedule/schedule.module';

@Module({
  imports: [
    // ... vos modules existants ...
    AIRoutineModule,
    AiMatchingModule,
    ScheduleModule,
    // ...
  ],
})
export class AppModule {}
```

---

## ⚙️ Configuration .env

Ajoutez dans votre fichier `.env` :

```env
# IA
GEMINI_API_KEY=votre_cle_api_gemini
HF_API_KEY=votre_cle_api_huggingface

# Cache (optionnel)
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## ✅ Vérification

### 1. Compiler
```bash
npm run build
```

### 2. Démarrer
```bash
npm run start:dev
```

### 3. Vérifier Swagger
Ouvrez : http://localhost:3005/api

Vous devriez voir :
- ✅ Tag "AI Routine"
- ✅ Tag "AI Matching"
- ✅ Tag "schedule"

### 4. Tests rapides

```bash
# Health check AI Routine
curl http://localhost:3005/ai/routine/health

# Health check AI Matching
curl http://localhost:3005/ai-matching/health
```

---

## 📖 Endpoints disponibles

### AI Routine
- `POST /ai/routine/analyze` - Analyse de routine
- `POST /ai/routine/analyze-enhanced` - Analyse améliorée avec conflits
- `POST /ai/routine/check-job-compatibility` - Vérifier compatibilité offre
- `POST /ai/routine/quick-suggestion` - Suggestion rapide
- `GET /ai/routine/health` - Health check

### AI Matching
- `POST /ai-matching/analyze` - Analyser et matcher les offres
- `GET /ai-matching/health` - Health check

### Schedule
- `POST /schedule/process` - Traiter PDF d'emploi du temps
- `POST /schedule/create-events` - Créer événements automatiquement

---

## 🐛 Dépannage rapide

| Problème | Solution |
|----------|----------|
| Erreur "GEMINI_API_KEY required" | Vérifiez `.env` et redémarrez |
| Erreur "pdf2pic not found" | `npm install pdf2pic@^3.1.2` |
| Erreur "GraphicsMagick not found" | Installez GraphicsMagick |
| Erreur de compilation | Vérifiez que tous les modules sont copiés |
| OCR ne fonctionne pas | Vérifiez qualité du PDF et fichiers OCR |

Pour plus de solutions, consultez **DOCUMENTATION_INTEGRATION.md** section "Dépannage".

---

## 📞 Support

1. Consultez **DOCUMENTATION_INTEGRATION.md** pour les détails
2. Consultez **GUIDE_MIGRATION_RAPIDE.md** pour une version simplifiée
3. Exécutez **COMMANDES_INSTALLATION.sh** pour une installation guidée

---

## 📝 Checklist finale

- [ ] Dépendances npm installées
- [ ] GraphicsMagick installé
- [ ] `.env` configuré avec clés API
- [ ] Modules copiés
- [ ] `app.module.ts` mis à jour
- [ ] Fichiers OCR copiés (optionnel)
- [ ] Projet compilé sans erreur
- [ ] Serveur démarre correctement
- [ ] Swagger accessible
- [ ] Health checks OK

---

## 🎉 C'est tout !

Une fois l'installation terminée, vos endpoints IA seront disponibles et documentés dans Swagger.

**Bon développement ! 🚀**
