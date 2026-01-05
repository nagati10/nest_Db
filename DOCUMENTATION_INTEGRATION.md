# 📚 Documentation d'Intégration - Modules IA et Schedule

Cette documentation explique comment intégrer les modules **AI Routine**, **Schedule**, **AI Matching** et les autres fonctionnalités dans une version ancienne du backend.

---

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Installation des dépendances](#installation-des-dépendances)
3. [Configuration des variables d'environnement](#configuration-des-variables-denvironnement)
4. [Installation des dépendances système](#installation-des-dépendances-système)
5. [Structure des modules à copier](#structure-des-modules-à-copier)
6. [Intégration dans app.module.ts](#intégration-dans-appmodulets)
7. [Fichiers de langue OCR](#fichiers-de-langue-ocr)
8. [Vérification et tests](#vérification-et-tests)
9. [Dépannage](#dépannage)

---

## 🔧 Prérequis

- Node.js 18+ installé
- MongoDB configuré (local ou Atlas)
- Backend NestJS existant
- npm ou yarn

---

## 📦 Installation des dépendances

### Étape 1 : Installer les packages npm

```bash
# Dans le répertoire du backend
npm install @google/generative-ai@^0.24.1
npm install @huggingface/inference@^4.13.4
npm install @nestjs/cache-manager@^3.0.1
npm install pdf-lib@^1.17.1
npm install pdf2pic@^3.1.2
npm install sharp@^0.33.0
npm install tesseract.js@^6.0.1
npm install cache-manager-redis-store@^3.0.1
```

**OU en une seule commande :**

```bash
npm install @google/generative-ai@^0.24.1 @huggingface/inference@^4.13.4 @nestjs/cache-manager@^3.0.1 pdf-lib@^1.17.1 pdf2pic@^3.1.2 sharp@^0.33.0 tesseract.js@^6.0.1 cache-manager-redis-store@^3.0.1
```

### Étape 2 : Vérifier les dépendances existantes

Assurez-vous que ces packages sont déjà installés (sinon, installez-les) :

```bash
npm install @nestjs/common@^11.1.8
npm install @nestjs/config@^4.0.2
npm install @nestjs/core@^11.1.8
npm install @nestjs/jwt@^11.0.1
npm install @nestjs/mongoose@^11.0.3
npm install @nestjs/passport@^11.0.5
npm install @nestjs/platform-express@^11.1.8
npm install @nestjs/swagger@^11.2.1
npm install class-validator@^0.14.2
npm install class-transformer@^0.5.1
npm install mongoose@^8.19.2
```

---

## 🔐 Configuration des variables d'environnement

### Créer/Mettre à jour le fichier `.env`

Ajoutez ces variables dans votre fichier `.env` :

```env
# ============================================
# CONFIGURATION IA
# ============================================

# Google Gemini API (OBLIGATOIRE pour AI Routine)
# Obtenez votre clé sur: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=votre_cle_api_gemini_ici

# Hugging Face API (OPTIONNEL pour AI Matching)
# Si non fourni, le matching utilisera uniquement les algorithmes locaux
# Obtenez votre clé sur: https://huggingface.co/settings/tokens
HF_API_KEY=votre_cle_api_huggingface_ici

# ============================================
# CONFIGURATION CACHE (Redis - OPTIONNEL)
# ============================================
# Si Redis n'est pas disponible, le cache utilisera la mémoire
REDIS_HOST=localhost
REDIS_PORT=6379

# ============================================
# CONFIGURATION EXISTANTE (si pas déjà présent)
# ============================================
JWT_SECRET=votre_secret_jwt
MONGODB_URI=mongodb://localhost:27017/Talleb_5edma
# OU pour MongoDB Atlas:
# DB_USERNAME=votre_username
# DB_PASSWORD=votre_password
# DB_CLUSTER=votre_cluster.mongodb.net
# DB_NAME=Talleb_5edma
```

### Notes importantes :

1. **GEMINI_API_KEY** : **OBLIGATOIRE** pour AI Routine
   - Sans cette clé, les endpoints AI Routine ne fonctionneront pas
   - Obtenez-la gratuitement sur [Google AI Studio](https://makersuite.google.com/app/apikey)

2. **HF_API_KEY** : **OPTIONNEL** pour AI Matching
   - Si non fourni, le matching fonctionne mais avec des recommandations basiques (sans IA)
   - Obtenez-la gratuitement sur [Hugging Face](https://huggingface.co/settings/tokens)

3. **Redis** : **OPTIONNEL** pour le cache
   - Si non configuré, le cache utilise la mémoire (moins performant mais fonctionne)

---

## 🖥️ Installation des dépendances système

### Pour le traitement PDF (Schedule Service)

Le module Schedule nécessite **GraphicsMagick** ou **ImageMagick** pour convertir les PDF en images.

#### macOS :

```bash
brew install graphicsmagick
```

#### Linux (Ubuntu/Debian) :

```bash
sudo apt-get update
sudo apt-get install graphicsmagick
```

#### Linux (CentOS/RHEL) :

```bash
sudo yum install GraphicsMagick
```

#### Windows :

Téléchargez depuis : https://www.graphicsmagick.org/download.html

**Vérification de l'installation :**

```bash
gm version
# ou
graphicsmagick -version
```

---

## 📁 Structure des modules à copier

Copiez ces dossiers et fichiers dans votre backend :

```
src/
├── ai-routine/                    # Module AI Routine (Google Gemini)
│   ├── ai-routine.controller.ts
│   ├── ai-routine.service.ts
│   ├── ai-routine-enhanced.service.ts
│   ├── ai-routine.module.ts
│   ├── dto/
│   │   ├── routine-input.dto.ts
│   │   ├── routine-response.dto.ts
│   │   ├── job-compatibility.dto.ts
│   │   └── conflict.dto.ts
│   └── schemas/
│       └── routine-history.schema.ts
│
├── ai-matching/                   # Module AI Matching (Hugging Face)
│   ├── ai-matching.controller.ts
│   ├── ai-matching.service.ts
│   ├── ai-matching.module.ts
│   └── dto/
│       ├── matching-request.dto.ts
│       └── matching-response.dto.ts
│
├── schedule/                      # Module Schedule (OCR + Parsing)
│   ├── schedule.controller.ts
│   ├── schedule.service.ts
│   └── schedule.module.ts
│
└── evenement/                     # Module Evenement (si pas déjà présent)
    ├── evenement.controller.ts
    ├── evenement.service.ts
    ├── evenement.module.ts
    ├── dto/
    │   ├── create-evenement.dto.ts
    │   └── update-evenement.dto.ts
    └── schemas/
        └── evenement.schema.ts
```

### Modules dépendants requis :

Assurez-vous que ces modules existent dans votre backend :

- `User` (pour l'authentification)
- `Auth` (pour JWT)
- `offre` (pour AI Matching)
- `student_preference` (pour AI Matching)
- `disponibilite` (pour AI Matching)
- `evenement` (pour Schedule)

---

## 🔗 Intégration dans app.module.ts

### Étape 1 : Importer les modules

Ajoutez ces imports dans `src/app.module.ts` :

```typescript
import { AIRoutineModule } from './ai-routine/ai-routine.module';
import { AiMatchingModule } from './ai-matching/ai-matching.module';
import { ScheduleModule } from './schedule/schedule.module';
import { EvenementModule } from './evenement/evenement.module'; // Si pas déjà présent
```

### Étape 2 : Ajouter dans le tableau `imports`

```typescript
@Module({
  imports: [
    // ... vos modules existants ...
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
        '.env.local',
        '.env',
      ].filter(Boolean),
    }),
    
    // Nouveaux modules à ajouter
    AIRoutineModule,
    AiMatchingModule,
    ScheduleModule,
    EvenementModule, // Si pas déjà présent
    
    // ... autres modules ...
  ],
  // ...
})
export class AppModule {}
```

### Étape 3 : Vérifier les guards et decorators

Assurez-vous que ces fichiers existent dans `src/auth/` :

```
auth/
├── guards/
│   └── jwt-auth.guard.ts
└── decorators/
    └── current-user.decorator.ts
```

Si `current-user.decorator.ts` n'existe pas, créez-le :

```typescript
// src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

---

## 📄 Fichiers de langue OCR

Pour que l'OCR fonctionne correctement, copiez ces fichiers dans la racine du projet :

```
racine_du_projet/
├── fra.traineddata    # Fichier de langue française pour Tesseract
└── eng.traineddata    # Fichier de langue anglaise pour Tesseract
```

**Note :** Ces fichiers sont déjà présents dans le projet actuel. Copiez-les dans le nouveau backend.

Si les fichiers ne sont pas disponibles, Tesseract.js les téléchargera automatiquement lors du premier usage, mais cela peut prendre du temps.

---

## ✅ Vérification et tests

### Étape 1 : Compiler le projet

```bash
npm run build
```

### Étape 2 : Démarrer le serveur

```bash
npm run start:dev
```

### Étape 3 : Vérifier les endpoints Swagger

Ouvrez votre navigateur sur : `http://localhost:3005/api`

Vous devriez voir ces nouveaux tags :

- ✅ **AI Routine** - Endpoints pour l'analyse de routine
- ✅ **AI Matching** - Endpoints pour le matching d'offres
- ✅ **schedule** - Endpoints pour le traitement PDF

### Étape 4 : Tests des endpoints

#### Test AI Routine (nécessite GEMINI_API_KEY)

```bash
# Health check
curl http://localhost:3005/ai/routine/health

# Analyse (nécessite JWT token)
curl -X POST http://localhost:3005/ai/routine/analyze \
  -H "Authorization: Bearer VOTRE_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "evenements": [...],
    "disponibilites": [...],
    "dateDebut": "2024-01-01",
    "dateFin": "2024-01-07"
  }'
```

#### Test AI Matching

```bash
# Health check
curl http://localhost:3005/ai-matching/health

# Analyse (nécessite JWT token)
curl -X POST http://localhost:3005/ai-matching/analyze \
  -H "Authorization: Bearer VOTRE_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "disponibilites": [
      {
        "jour": "Lundi",
        "heureDebut": "09:00",
        "heureFin": "17:00"
      }
    ]
  }'
```

#### Test Schedule (nécessite GraphicsMagick)

```bash
# Upload PDF (nécessite fichier PDF)
curl -X POST http://localhost:3005/schedule/process \
  -F "file=@chemin/vers/votre/emploi_du_temps.pdf"
```

---

## 🔍 Dépannage

### Problème 1 : Erreur "GEMINI_API_KEY est requise"

**Solution :**
- Vérifiez que `GEMINI_API_KEY` est bien défini dans `.env`
- Redémarrez le serveur après modification du `.env`
- Vérifiez qu'il n'y a pas d'espaces dans la valeur : `GEMINI_API_KEY=votre_cle` (pas d'espaces autour du `=`)

### Problème 2 : Erreur "Cannot find module 'pdf2pic'"

**Solution :**
```bash
npm install pdf2pic@^3.1.2
```

### Problème 3 : Erreur "GraphicsMagick not found"

**Solution :**
- Installez GraphicsMagick (voir section "Installation des dépendances système")
- Vérifiez avec : `gm version`
- Sur Windows, ajoutez GraphicsMagick au PATH

### Problème 4 : OCR ne fonctionne pas / Texte vide

**Solution :**
- Vérifiez que les fichiers `fra.traineddata` et `eng.traineddata` sont présents
- Vérifiez que le PDF est lisible (pas scanné de mauvaise qualité)
- Augmentez la qualité du PDF source

### Problème 5 : Erreur Redis connection

**Solution :**
- Si Redis n'est pas installé, le cache utilisera la mémoire (fonctionne mais moins performant)
- Pour désactiver Redis, modifiez `ai-routine.module.ts` :

```typescript
// Remplacez CacheModule.registerAsync par :
CacheModule.register({
  ttl: 3600, // 1 heure
  max: 100, // Nombre max d'éléments en cache
});
```

### Problème 6 : Module not found errors

**Solution :**
```bash
# Réinstaller toutes les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Problème 7 : Erreur "JWT_SECRET is required"

**Solution :**
- Ajoutez `JWT_SECRET=votre_secret` dans `.env`
- Utilisez un secret fort (minimum 32 caractères)

---

## 📝 Checklist d'intégration

Cochez chaque étape au fur et à mesure :

- [ ] Dépendances npm installées
- [ ] GraphicsMagick installé et vérifié
- [ ] Variables d'environnement configurées (`.env`)
- [ ] Modules copiés dans `src/`
- [ ] Modules ajoutés dans `app.module.ts`
- [ ] Guards et decorators vérifiés
- [ ] Fichiers de langue OCR copiés
- [ ] Projet compilé sans erreurs (`npm run build`)
- [ ] Serveur démarre sans erreurs (`npm run start:dev`)
- [ ] Endpoints visibles dans Swagger (`/api`)
- [ ] Test AI Routine health check OK
- [ ] Test AI Matching health check OK
- [ ] Test Schedule upload PDF OK

---

## 🚀 Commandes rapides de référence

```bash
# Installation complète des dépendances
npm install @google/generative-ai@^0.24.1 @huggingface/inference@^4.13.4 @nestjs/cache-manager@^3.0.1 pdf-lib@^1.17.1 pdf2pic@^3.1.2 sharp@^0.33.0 tesseract.js@^6.0.1 cache-manager-redis-store@^3.0.1

# Installation GraphicsMagick (macOS)
brew install graphicsmagick

# Installation GraphicsMagick (Linux)
sudo apt-get install graphicsmagick

# Compilation
npm run build

# Démarrage développement
npm run start:dev

# Vérification Swagger
# Ouvrir: http://localhost:3005/api
```

---

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs du serveur
2. Vérifiez que toutes les variables d'environnement sont définies
3. Vérifiez que GraphicsMagick est installé
4. Vérifiez que MongoDB est accessible
5. Consultez la section "Dépannage" ci-dessus

---

## 📚 Documentation des endpoints

Une fois intégré, consultez la documentation Swagger complète sur :
**http://localhost:3005/api**

Les endpoints seront documentés avec :
- Paramètres requis
- Exemples de requêtes
- Exemples de réponses
- Codes d'erreur possibles

---

**Bon développement ! 🎉**
