# 🚀 Guide de Migration Rapide - Étape par Étape

Guide simplifié pour intégrer rapidement les modules IA dans votre backend existant.

---

## ⚡ Installation Express (5 minutes)

### 1. Installer les dépendances npm

```bash
npm install @google/generative-ai@^0.24.1 @huggingface/inference@^4.13.4 @nestjs/cache-manager@^3.0.1 pdf-lib@^1.17.1 pdf2pic@^3.1.2 sharp@^0.33.0 tesseract.js@^6.0.1 cache-manager-redis-store@^3.0.1
```

### 2. Installer GraphicsMagick (système)

**macOS :**
```bash
brew install graphicsmagick
```

**Linux :**
```bash
sudo apt-get update && sudo apt-get install graphicsmagick
```

### 3. Configurer `.env`

Ajoutez dans votre fichier `.env` :

```env
GEMINI_API_KEY=votre_cle_api_gemini
HF_API_KEY=votre_cle_api_huggingface
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Où obtenir les clés :**
- Gemini : https://makersuite.google.com/app/apikey
- Hugging Face : https://huggingface.co/settings/tokens

### 4. Copier les modules

Copiez ces dossiers depuis le projet actuel vers votre backend :

```
src/ai-routine/
src/ai-matching/
src/schedule/
```

### 5. Mettre à jour `app.module.ts`

Ajoutez ces imports :

```typescript
import { AIRoutineModule } from './ai-routine/ai-routine.module';
import { AiMatchingModule } from './ai-matching/ai-matching.module';
import { ScheduleModule } from './schedule/schedule.module';
```

Ajoutez dans le tableau `imports` :

```typescript
@Module({
  imports: [
    // ... vos modules existants ...
    AIRoutineModule,
    AiMatchingModule,
    ScheduleModule,
    // ...
  ],
})
```

### 6. Copier les fichiers OCR

Copiez `fra.traineddata` et `eng.traineddata` à la racine du projet.

### 7. Tester

```bash
npm run build
npm run start:dev
```

Ouvrez : http://localhost:3005/api

---

## ✅ Vérification rapide

### Test 1 : Health checks

```bash
# AI Routine
curl http://localhost:3005/ai/routine/health

# AI Matching
curl http://localhost:3005/ai-matching/health
```

### Test 2 : Swagger

Ouvrez http://localhost:3005/api et vérifiez la présence des tags :
- ✅ AI Routine
- ✅ AI Matching
- ✅ schedule

---

## 🔧 Si ça ne fonctionne pas

### Erreur "GEMINI_API_KEY required"
→ Vérifiez votre `.env` et redémarrez le serveur

### Erreur "pdf2pic not found"
→ `npm install pdf2pic@^3.1.2`

### Erreur "GraphicsMagick not found"
→ Installez GraphicsMagick (voir étape 2)

### Erreur de compilation
→ Vérifiez que tous les modules sont bien copiés

---

## 📋 Checklist minimale

- [ ] Dépendances npm installées
- [ ] GraphicsMagick installé
- [ ] `.env` configuré avec GEMINI_API_KEY
- [ ] Modules copiés (ai-routine, ai-matching, schedule)
- [ ] `app.module.ts` mis à jour
- [ ] Fichiers OCR copiés
- [ ] Serveur démarre sans erreur
- [ ] Swagger accessible

---

**C'est tout ! 🎉**

Pour plus de détails, consultez `DOCUMENTATION_INTEGRATION.md`
