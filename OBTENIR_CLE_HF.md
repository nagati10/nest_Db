# 🔑 Obtenir une Clé API Hugging Face

## ❌ Problème Actuel

Erreur : `Invalid username or password`

→ La clé API Hugging Face dans votre `.env` est invalide ou expirée.

---

## ✅ Solution : Obtenir une Nouvelle Clé (Gratuit, 2 minutes)

### Étape 1 : Créer un Compte (si nécessaire)

1. Visitez : https://huggingface.co/join
2. Inscrivez-vous avec votre email
3. Vérifiez votre email

### Étape 2 : Créer un Token d'Accès

1. **Allez dans Settings** : https://huggingface.co/settings/tokens
2. **Cliquez sur "New token"**
3. **Configurez le token** :
   - **Name** : `AI-Routine` (ou ce que vous voulez)
   - **Type** : `Read` (suffisant pour l'inférence)
   - **Repositories** : Laissez vide (accès global)
4. **Cliquez sur "Generate token"**
5. **Copiez le token** : Il commence par `hf_...`

**⚠️ Important :** Copiez-le immédiatement, vous ne pourrez plus le voir après !

### Étape 3 : Mettre à Jour le .env

Ouvrez votre fichier `.env` et modifiez/ajoutez :

```bash
HF_API_KEY=hf_VotreNouveauTokenIci
```

**Exemple complet de .env :**
```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017/Talleb_5edma

# JWT
JWT_SECRET=votre_secret_jwt

# Hugging Face (NOUVELLE CLÉ)
HF_API_KEY=hf_abcdefghijklmnopqrstuvwxyz1234567890

# Gemini
GEMINI_API_KEY=AIzaSyA9dyiwzbYd0BOh28GfIOfdWMvyGfr7fUo
```

### Étape 4 : Redémarrer l'Application

```bash
# L'application devrait se recompiler automatiquement
# Sinon :
npm run start:dev
```

---

## 📊 Vérification

### Logs Attendus

**✅ Succès :**
```
[AIRoutineEnhancedService] ✅ Hugging Face initialisé pour AI-Routine
[AiMatchingService] ✅ Hugging Face initialisé avec succès
```

**❌ Si toujours erreur :**
```
[AIRoutineEnhancedService] Erreur Hugging Face: Invalid username or password
```
→ Vérifiez que vous avez bien copié la clé complète

### Test Manuel

Testez votre clé directement :

```bash
curl https://huggingface.co/api/whoami-v2 \
  -H "Authorization: Bearer hf_VotreTokenIci"
```

**Réponse attendue :**
```json
{
  "type": "user",
  "name": "votre_username",
  ...
}
```

---

## 🎯 Alternative : Désactiver Hugging Face Temporairement

Si vous voulez tester sans HF, commentez la clé dans `.env` :

```bash
# HF_API_KEY=hf_...
```

L'application utilisera alors les recommandations par défaut (qui fonctionnent déjà très bien !).

---

## 🔍 Dépannage

### Problème 1 : "Token not found"

**Cause :** Token mal copié ou incomplet

**Solution :**
- Vérifiez que le token commence par `hf_`
- Vérifiez qu'il n'y a pas d'espaces avant/après
- Recréez un nouveau token si nécessaire

### Problème 2 : "403 Forbidden"

**Cause :** Token de type "Write" au lieu de "Read"

**Solution :**
- Recréez un token de type "Read"
- Les tokens "Write" ne fonctionnent pas pour l'inférence

### Problème 3 : "Rate limit exceeded"

**Cause :** Trop de requêtes (rare avec le plan gratuit)

**Solution :**
- Attendez quelques minutes
- Vérifiez vos quotas : https://huggingface.co/settings/tokens

---

## 💡 Types de Tokens

| Type | Usage | Pour AI-Routine |
|------|-------|----------------|
| **Read** ✅ | Lecture + Inférence | ✅ Parfait |
| **Write** | Lecture + Écriture | ❌ Ne fonctionne pas |
| **Fine-grained** | Accès spécifique | ⚠️ Plus complexe |

**Pour AI-Routine : Utilisez "Read" !**

---

## 📝 Checklist

Après création du token :

- [ ] Token copié (commence par `hf_`)
- [ ] Ajouté dans `.env` : `HF_API_KEY=hf_...`
- [ ] Pas d'espaces avant/après
- [ ] Application redémarrée
- [ ] Log "✅ Hugging Face initialisé"
- [ ] Test Swagger réussi

---

## 🎉 Une Fois Configuré

Avec une clé HF valide, vous aurez :

- ✅ Recommandations IA personnalisées
- ✅ Suggestions adaptées à votre contexte
- ✅ Analyse en français
- ✅ Gratuit et illimité (dans les quotas)

---

## 📚 Ressources

- **Créer un token** : https://huggingface.co/settings/tokens
- **Documentation HF** : https://huggingface.co/docs/api-inference
- **Vérifier quotas** : https://huggingface.co/pricing
- **Support** : https://discuss.huggingface.co/

---

**Obtenir une clé HF prend 2 minutes et c'est gratuit ! 🤗**

