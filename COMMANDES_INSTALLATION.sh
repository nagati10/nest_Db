#!/bin/bash

# ============================================
# Script d'installation automatique
# Modules IA et Schedule pour Backend NestJS
# ============================================

echo "🚀 Démarrage de l'installation..."

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================
# ÉTAPE 1 : Vérifier Node.js
# ============================================
echo -e "\n${YELLOW}📦 Vérification de Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé. Veuillez l'installer d'abord.${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js installé : $NODE_VERSION${NC}"

# ============================================
# ÉTAPE 2 : Installer les dépendances npm
# ============================================
echo -e "\n${YELLOW}📦 Installation des dépendances npm...${NC}"
npm install @google/generative-ai@^0.24.1 \
            @huggingface/inference@^4.13.4 \
            @nestjs/cache-manager@^3.0.1 \
            pdf-lib@^1.17.1 \
            pdf2pic@^3.1.2 \
            sharp@^0.33.0 \
            tesseract.js@^6.0.1 \
            cache-manager-redis-store@^3.0.1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dépendances npm installées avec succès${NC}"
else
    echo -e "${RED}❌ Erreur lors de l'installation des dépendances npm${NC}"
    exit 1
fi

# ============================================
# ÉTAPE 3 : Vérifier/Installer GraphicsMagick
# ============================================
echo -e "\n${YELLOW}🖼️  Vérification de GraphicsMagick...${NC}"
if command -v gm &> /dev/null || command -v graphicsmagick &> /dev/null; then
    echo -e "${GREEN}✅ GraphicsMagick est déjà installé${NC}"
else
    echo -e "${YELLOW}⚠️  GraphicsMagick n'est pas installé${NC}"
    
    # Détecter le système d'exploitation
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        echo -e "${YELLOW}Installation via Homebrew...${NC}"
        if command -v brew &> /dev/null; then
            brew install graphicsmagick
        else
            echo -e "${RED}❌ Homebrew n'est pas installé. Installez GraphicsMagick manuellement.${NC}"
            echo -e "${YELLOW}Commande: brew install graphicsmagick${NC}"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        echo -e "${YELLOW}Installation via apt-get...${NC}"
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y graphicsmagick
        else
            echo -e "${RED}❌ apt-get n'est pas disponible. Installez GraphicsMagick manuellement.${NC}"
        fi
    else
        echo -e "${RED}❌ Système d'exploitation non supporté. Installez GraphicsMagick manuellement.${NC}"
    fi
fi

# ============================================
# ÉTAPE 4 : Vérifier le fichier .env
# ============================================
echo -e "\n${YELLOW}🔐 Vérification du fichier .env...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Le fichier .env n'existe pas. Création d'un template...${NC}"
    cat > .env << EOF
# Configuration IA
GEMINI_API_KEY=votre_cle_api_gemini_ici
HF_API_KEY=votre_cle_api_huggingface_ici

# Configuration Cache (optionnel)
REDIS_HOST=localhost
REDIS_PORT=6379

# Configuration existante
JWT_SECRET=votre_secret_jwt
MONGODB_URI=mongodb://localhost:27017/Talleb_5edma
EOF
    echo -e "${GREEN}✅ Fichier .env créé. Veuillez le compléter avec vos clés API.${NC}"
else
    echo -e "${GREEN}✅ Fichier .env existe${NC}"
    
    # Vérifier si GEMINI_API_KEY est présent
    if grep -q "GEMINI_API_KEY" .env; then
        echo -e "${GREEN}✅ GEMINI_API_KEY trouvé dans .env${NC}"
    else
        echo -e "${YELLOW}⚠️  GEMINI_API_KEY non trouvé. Ajoutez-le dans .env${NC}"
    fi
fi

# ============================================
# ÉTAPE 5 : Vérifier la structure des modules
# ============================================
echo -e "\n${YELLOW}📁 Vérification de la structure des modules...${NC}"
MODULES=("src/ai-routine" "src/ai-matching" "src/schedule")
MISSING_MODULES=()

for module in "${MODULES[@]}"; do
    if [ -d "$module" ]; then
        echo -e "${GREEN}✅ Module $module trouvé${NC}"
    else
        echo -e "${RED}❌ Module $module manquant${NC}"
        MISSING_MODULES+=("$module")
    fi
done

if [ ${#MISSING_MODULES[@]} -gt 0 ]; then
    echo -e "${RED}❌ Modules manquants détectés. Veuillez copier ces dossiers depuis le projet source.${NC}"
    for module in "${MISSING_MODULES[@]}"; do
        echo -e "${YELLOW}  - $module${NC}"
    done
fi

# ============================================
# ÉTAPE 6 : Vérifier app.module.ts
# ============================================
echo -e "\n${YELLOW}🔍 Vérification de app.module.ts...${NC}"
if [ -f "src/app.module.ts" ]; then
    if grep -q "AIRoutineModule" src/app.module.ts; then
        echo -e "${GREEN}✅ AIRoutineModule trouvé dans app.module.ts${NC}"
    else
        echo -e "${YELLOW}⚠️  AIRoutineModule non trouvé. Ajoutez-le dans app.module.ts${NC}"
    fi
    
    if grep -q "AiMatchingModule" src/app.module.ts; then
        echo -e "${GREEN}✅ AiMatchingModule trouvé dans app.module.ts${NC}"
    else
        echo -e "${YELLOW}⚠️  AiMatchingModule non trouvé. Ajoutez-le dans app.module.ts${NC}"
    fi
    
    if grep -q "ScheduleModule" src/app.module.ts; then
        echo -e "${GREEN}✅ ScheduleModule trouvé dans app.module.ts${NC}"
    else
        echo -e "${YELLOW}⚠️  ScheduleModule non trouvé. Ajoutez-le dans app.module.ts${NC}"
    fi
else
    echo -e "${RED}❌ Fichier app.module.ts non trouvé${NC}"
fi

# ============================================
# ÉTAPE 7 : Vérifier les fichiers OCR
# ============================================
echo -e "\n${YELLOW}📄 Vérification des fichiers OCR...${NC}"
OCR_FILES=("fra.traineddata" "eng.traineddata")
MISSING_OCR=()

for file in "${OCR_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ Fichier $file trouvé${NC}"
    else
        echo -e "${YELLOW}⚠️  Fichier $file manquant (sera téléchargé automatiquement par Tesseract.js)${NC}"
        MISSING_OCR+=("$file")
    fi
done

# ============================================
# RÉSUMÉ
# ============================================
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}📋 RÉSUMÉ DE L'INSTALLATION${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}✅ Étapes complétées :${NC}"
echo -e "  - Dépendances npm installées"
echo -e "  - GraphicsMagick vérifié/installé"
echo -e "  - Fichier .env vérifié/créé"

if [ ${#MISSING_MODULES[@]} -gt 0 ]; then
    echo -e "\n${RED}❌ Actions requises :${NC}"
    echo -e "  - Copier les modules manquants"
    echo -e "  - Mettre à jour app.module.ts"
fi

echo -e "\n${YELLOW}📝 Prochaines étapes :${NC}"
echo -e "  1. Compléter le fichier .env avec vos clés API"
echo -e "  2. Copier les modules manquants (si nécessaire)"
echo -e "  3. Mettre à jour app.module.ts (si nécessaire)"
echo -e "  4. Exécuter : npm run build"
echo -e "  5. Exécuter : npm run start:dev"
echo -e "  6. Vérifier : http://localhost:3005/api"

echo -e "\n${GREEN}🎉 Installation terminée !${NC}\n"
