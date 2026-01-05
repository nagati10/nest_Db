#!/bin/bash

echo "🔧 Configuration du fichier .env"
echo ""

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    echo "⚠️  Le fichier $ENV_FILE existe déjà"
    echo ""
    echo "Contenu actuel:"
    cat "$ENV_FILE"
    echo ""
    read -p "Voulez-vous l'écraser? (o/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        echo "❌ Annulé"
        exit 0
    fi
fi

echo "Création du fichier $ENV_FILE..."
cat > "$ENV_FILE" << 'ENVEOF'
# Google Gemini AI (OBLIGATOIRE pour le module AI Routine)
# Obtenez votre clé sur: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=votre_cle_api_ici

# JWT Secret (si nécessaire)
# JWT_SECRET=votre_secret_jwt

# MongoDB (si nécessaire)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname

# Redis Cache (optionnel)
# REDIS_HOST=localhost
# REDIS_PORT=6379
ENVEOF

echo "✅ Fichier $ENV_FILE créé!"
echo ""
echo "📝 IMPORTANT: Éditez le fichier $ENV_FILE et remplacez 'votre_cle_api_ici' par votre vraie clé API Gemini"
echo ""
echo "Pour obtenir une clé API:"
echo "1. Allez sur https://makersuite.google.com/app/apikey"
echo "2. Connectez-vous avec Google"
echo "3. Cliquez sur 'Create API Key'"
echo "4. Copiez la clé et collez-la dans $ENV_FILE"
echo ""
