const fs = require('fs');
const path = require('path');

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
const envPath = path.join(__dirname, envFile);

console.log(`\n🔍 Vérification du fichier ${envFile}...\n`);

if (fs.existsSync(envPath)) {
  console.log(`✅ Le fichier ${envFile} existe`);
  const content = fs.readFileSync(envPath, 'utf8');
  
  if (content.includes('GEMINI_API_KEY')) {
    const lines = content.split('\n');
    const geminiLine = lines.find(line => line.includes('GEMINI_API_KEY'));
    if (geminiLine && !geminiLine.includes('AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')) {
      console.log('✅ GEMINI_API_KEY est définie');
      console.log(`   ${geminiLine.substring(0, 30)}...`);
    } else {
      console.log('⚠️  GEMINI_API_KEY est présente mais semble être un exemple');
      console.log('   Remplacez-la par votre vraie clé API');
    }
  } else {
    console.log('❌ GEMINI_API_KEY n\'est pas définie dans le fichier');
    console.log(`\nAjoutez cette ligne dans ${envFile}:`);
    console.log('GEMINI_API_KEY=votre_cle_api_ici\n');
  }
} else {
  console.log(`❌ Le fichier ${envFile} n'existe pas`);
  console.log(`\nCréez le fichier ${envFile} à la racine du projet avec:`);
  console.log('GEMINI_API_KEY=votre_cle_api_ici\n');
}

console.log(`📝 Fichier utilisé: ${envFile}`);
console.log(`📁 Chemin: ${envPath}\n`);
