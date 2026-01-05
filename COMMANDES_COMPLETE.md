# 📋 Toutes les Commandes - Copier/Coller

Fichier de référence avec toutes les commandes nécessaires pour l'intégration.

---

## 🚀 Installation complète (une seule commande)

```bash
npm install @google/generative-ai@^0.24.1 @huggingface/inference@^4.13.4 @nestjs/cache-manager@^3.0.1 pdf-lib@^1.17.1 pdf2pic@^3.1.2 sharp@^0.33.0 tesseract.js@^6.0.1 cache-manager-redis-store@^3.0.1
```

---

## 🖥️ Installation GraphicsMagick

### macOS
```bash
brew install graphicsmagick
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install graphicsmagick
```

### Vérification
```bash
gm version
```

---

## 🔐 Configuration .env

Créez ou modifiez votre fichier `.env` :

```env
# Configuration IA
GEMINI_API_KEY=votre_cle_api_gemini_ici
HF_API_KEY=votre_cle_api_huggingface_ici

# Configuration Cache (optionnel)
REDIS_HOST=localhost
REDIS_PORT=6379

# Configuration existante (ajoutez les vôtres)
JWT_SECRET=votre_secret_jwt
MONGODB_URI=mongodb://localhost:27017/Talleb_5edma
```

---

## 📦 Installation dépendances individuelles

Si vous préférez installer une par une :

```bash
npm install @google/generative-ai@^0.24.1
npm install @huggingface/inference@^4.13.4
npm install @nestjs/cache-manager@^3.0.1
npm install pdf-lib@^1.17.1
npm install pdf2pic@^3.1.2
npm install sharp@^0.33.0
npm install tesseract.js@^6.0.1
npm install cache-manager-redis-store@^3.0.1
```

---

## 🔨 Compilation et démarrage

```bash
# Compiler le projet
npm run build

# Démarrer en mode développement
npm run start:dev

# Démarrer en mode production
npm run start:prod
```

---

## ✅ Tests de vérification

### Health checks

```bash
# AI Routine
curl http://localhost:3005/ai/routine/health

# AI Matching
curl http://localhost:3005/ai-matching/health
```

### Swagger
Ouvrez dans votre navigateur : `http://localhost:3005/api`

---

## 🧪 Tests avec curl (nécessite JWT token)

### Test AI Routine

```bash
curl -X POST http://localhost:3005/ai/routine/analyze \
  -H "Authorization: Bearer VOTRE_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "evenements": [
      {
        "id": "1",
        "titre": "Cours Math",
        "type": "cours",
        "date": "2024-01-15",
        "heureDebut": "09:00",
        "heureFin": "10:30"
      }
    ],
    "disponibilites": [
      {
        "id": "1",
        "jour": "Lundi",
        "heureDebut": "09:00",
        "heureFin": "17:00"
      }
    ],
    "dateDebut": "2024-01-15",
    "dateFin": "2024-01-22"
  }'
```

### Test AI Matching

```bash
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

### Test Schedule (upload PDF)

```bash
curl -X POST http://localhost:3005/schedule/process \
  -F "file=@chemin/vers/votre/emploi_du_temps.pdf"
```

---

## 🧹 Nettoyage et réinstallation

Si vous rencontrez des problèmes :

```bash
# Supprimer node_modules et package-lock.json
rm -rf node_modules package-lock.json

# Réinstaller toutes les dépendances
npm install

# Recompiler
npm run build
```

---

## 📝 Commandes Git (si vous versionnez)

```bash
# Ajouter les nouveaux fichiers
git add src/ai-routine/
git add src/ai-matching/
git add src/schedule/
git add .env

# Commit
git commit -m "feat: Add AI Routine, AI Matching and Schedule modules"

# Push
git push
```

---

## 🔍 Vérification de l'installation

### Vérifier les packages installés

```bash
npm list @google/generative-ai
npm list @huggingface/inference
npm list tesseract.js
npm list pdf2pic
```

### Vérifier GraphicsMagick

```bash
gm version
# ou
graphicsmagick -version
```

### Vérifier les modules dans le code

```bash
# Vérifier que les modules sont importés
grep -r "AIRoutineModule" src/app.module.ts
grep -r "AiMatchingModule" src/app.module.ts
grep -r "ScheduleModule" src/app.module.ts
```

---

## 🐛 Commandes de dépannage

### Vérifier les logs

```bash
# Si le serveur ne démarre pas
npm run start:dev 2>&1 | tee logs.txt

# Vérifier les erreurs de compilation
npm run build 2>&1 | grep -i error
```

### Vérifier les variables d'environnement

```bash
# Vérifier que .env est chargé
node -e "require('dotenv').config(); console.log(process.env.GEMINI_API_KEY ? 'OK' : 'MANQUANT')"
```

### Réinstaller une dépendance spécifique

```bash
# Exemple pour pdf2pic
npm uninstall pdf2pic
npm install pdf2pic@^3.1.2
```

---

## 📚 Commandes de documentation

### Générer la documentation Swagger

La documentation est automatiquement générée. Accédez à :
```
http://localhost:3005/api
```

### Vérifier les endpoints disponibles

```bash
# Lister tous les endpoints (nécessite que le serveur soit démarré)
curl http://localhost:3005/api-json | jq '.paths | keys'
```

---

## 🎯 Commandes rapides de référence

```bash
# Installation complète
npm install @google/generative-ai@^0.24.1 @huggingface/inference@^4.13.4 @nestjs/cache-manager@^3.0.1 pdf-lib@^1.17.1 pdf2pic@^3.1.2 sharp@^0.33.0 tesseract.js@^6.0.1 cache-manager-redis-store@^3.0.1

# GraphicsMagick (macOS)
brew install graphicsmagick

# GraphicsMagick (Linux)
sudo apt-get install graphicsmagick

# Compilation
npm run build

# Démarrage
npm run start:dev

# Health checks
curl http://localhost:3005/ai/routine/health
curl http://localhost:3005/ai-matching/health
```

---

**💡 Astuce :** Sauvegardez ce fichier et utilisez-le comme référence rapide pendant l'installation !
