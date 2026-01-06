import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EvenementService } from '../evenement/evenement.service';
import { EventType } from '../evenement/schemas/evenement.schema';
import { EvenementDocument } from '../evenement/schemas/evenement.schema';
import { HfInference } from '@huggingface/inference';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

export interface Course {
  day: string;
  start: string;
  end: string;
  subject: string;
  classroom?: string;
}

export interface ProcessedSchedule {
  courses: Course[];
}

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);
  private hf: HfInference | null = null;
  private readonly OCR_MODEL = 'microsoft/trocr-small-printed';

  // Mapping des jours en français vers anglais
  private readonly dayMapping: { [key: string]: string } = {
    'lundi': 'Monday',
    'mardi': 'Tuesday',
    'mercredi': 'Wednesday',
    'jeudi': 'Thursday',
    'vendredi': 'Friday',
    'samedi': 'Saturday',
    'dimanche': 'Sunday',
  };

  // Jours en anglais
  private readonly englishDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  private readonly httpClient: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    private readonly evenementService: EvenementService,
  ) {
    this.initializeHuggingFace();
  }

  private initializeHuggingFace(): void {
    const hfApiKey = this.configService.get<string>('HF_API_KEY');
    
    if (!hfApiKey) {
      this.logger.warn('HF_API_KEY non définie - L\'OCR utilisera uniquement Tesseract.js (local)');
      this.logger.warn('Pour utiliser Hugging Face OCR en fallback, obtenez une clé sur: https://huggingface.co/settings/tokens');
      this.hf = null;
      return;
    }

    try {
      this.hf = new HfInference(hfApiKey);
      this.logger.log(`✅ Hugging Face initialisé (sera utilisé en fallback si Tesseract échoue)`);
    } catch (error) {
      this.logger.warn(`⚠️ Erreur lors de l'initialisation de Hugging Face: ${error.message}`);
      this.logger.warn('L\'OCR utilisera uniquement Tesseract.js (local)');
      this.hf = null;
    }
  }

  /**
   * Traite une image d'emploi du temps directement
   */
  async processScheduleImage(imageBuffer: Buffer): Promise<ProcessedSchedule> {
    try {
      this.logger.log('Starting image processing...');

      // 1. Valider et optimiser l'image avec Sharp
      let processedImage: Buffer;
      try {
        processedImage = await sharp(imageBuffer)
          .png() // Convertir en PNG pour une meilleure qualité OCR
          .toBuffer();
        this.logger.log(`Image processed and converted to PNG: ${processedImage.length} bytes`);
      } catch (sharpError) {
        this.logger.warn(`Sharp processing failed, using original buffer: ${sharpError.message}`);
        processedImage = imageBuffer; // Utiliser le buffer original si Sharp échoue
      }

      // 2. Traiter l'image avec OCR (Tesseract.js par défaut, Hugging Face en fallback si disponible)
      let text: string;
      
      try {
        // Essayer d'abord Tesseract.js (solution locale, fiable)
        this.logger.log('Processing image with Tesseract.js OCR...');
        text = await this.callTesseractOCR(processedImage);
        this.logger.log('✅ Tesseract.js OCR completed successfully');
      } catch (tesseractError) {
        this.logger.warn(`Tesseract.js OCR failed: ${tesseractError.message}`);
        
        // Fallback vers Hugging Face si disponible
        if (this.hf) {
          try {
            this.logger.log('Trying Hugging Face OCR as fallback...');
            text = await this.callHuggingFaceOCR(processedImage);
            this.logger.log('✅ Hugging Face OCR completed successfully');
          } catch (hfError) {
            this.logger.error(`Both OCR methods failed. Tesseract: ${tesseractError.message}, Hugging Face: ${hfError.message}`);
            throw new BadRequestException(
              `OCR failed with both methods. Tesseract error: ${tesseractError.message}. ` +
              `Please ensure the image is clear and contains readable text.`
            );
          }
        } else {
          // Si Hugging Face n'est pas disponible, relancer l'erreur Tesseract
          throw new BadRequestException(
            `OCR failed: ${tesseractError.message}. Please ensure the image is clear and contains readable text.`
          );
        }
      }

      this.logger.log('OCR completed, parsing text...');
      
      // Log le texte complet pour debug
      this.logger.debug(`Full OCR text:\n${text}`);

      // 3. Parser le texte en JSON structuré
      const courses = this.parseScheduleTextToJSON(text);

      this.logger.log(`Parsed ${courses.length} courses`);
      
      if (courses.length === 0) {
        this.logger.warn('No courses found in OCR text. The parsing algorithm may need adjustment for this schedule format.');
      }

      return { courses };
    } catch (error) {
      this.logger.error(`Error processing image: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to process image: ${error.message}`);
    }
  }

  /**
   * Traite un PDF d'emploi du temps complet (méthode conservée pour rétrocompatibilité)
   */
  async processSchedulePDF(pdfBuffer: Buffer): Promise<ProcessedSchedule> {
    try {
      this.logger.log('Starting PDF processing...');

      // 1. Convertir PDF en images
      const images = await this.convertPdfToImages(pdfBuffer);
      this.logger.log(`PDF converted to ${images.length} images`);

      // 2. Traiter chaque image avec OCR (Tesseract.js par défaut)
      let allText = '';
      for (let i = 0; i < images.length; i++) {
        this.logger.log(`Processing page ${i + 1}/${images.length} with OCR...`);
        let text: string;
        
        try {
          // Utiliser Tesseract.js par défaut
          text = await this.callTesseractOCR(images[i]);
        } catch (tesseractError) {
          // Fallback vers Hugging Face si disponible
          if (this.hf) {
            try {
              this.logger.log(`Tesseract failed for page ${i + 1}, trying Hugging Face...`);
              text = await this.callHuggingFaceOCR(images[i]);
            } catch (hfError) {
              this.logger.error(`Both OCR methods failed for page ${i + 1}`);
              throw new BadRequestException(`OCR failed for page ${i + 1}: ${tesseractError.message}`);
            }
          } else {
            throw new BadRequestException(`OCR failed for page ${i + 1}: ${tesseractError.message}`);
          }
        }
        
        allText += text + '\n';
      }

      this.logger.log('OCR completed, parsing text...');
      
      // Log le texte complet pour debug
      this.logger.debug(`Full OCR text:\n${allText}`);

      // 3. Parser le texte en JSON structuré
      const courses = this.parseScheduleTextToJSON(allText);

      this.logger.log(`Parsed ${courses.length} courses`);
      
      if (courses.length === 0) {
        this.logger.warn('No courses found in OCR text. The parsing algorithm may need adjustment for this schedule format.');
      }

      return { courses };
    } catch (error) {
      this.logger.error(`Error processing PDF: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to process PDF: ${error.message}`);
    }
  }

  /**
   * Convertit un PDF en tableau d'images (buffers)
   */
  async convertPdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
    try {
      // Créer un fichier temporaire pour le PDF
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-process-'));
      const tempPdfPath = path.join(tempDir, 'input.pdf');
      
      fs.writeFileSync(tempPdfPath, pdfBuffer);

      // Utiliser pdf-poppler pour convertir le PDF en images
      const pdf2pic = require('pdf2pic');
      
      const convert = pdf2pic.fromPath(tempPdfPath, {
        density: 300, // DPI élevé pour meilleure qualité OCR
        saveFilename: 'page',
        savePath: tempDir,
        format: 'png',
        width: 2000,
        height: 2000,
      });

      // Lire le nombre de pages du PDF
      const PDFDocument = require('pdf-lib').PDFDocument;
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const numPages = pdfDoc.getPageCount();

      const images: Buffer[] = [];

      // Convertir chaque page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const result = await convert(pageNum, { responseType: 'image' });
          
          this.logger.log(`Page ${pageNum} conversion result type: ${typeof result}, has path: ${!!result?.path}`);
          
          // pdf2pic retourne un objet avec path vers le fichier généré
          if (result && result.path && fs.existsSync(result.path)) {
            const rawBuffer = fs.readFileSync(result.path);
            this.logger.log(`Page ${pageNum} raw file: ${rawBuffer.length} bytes`);
            
            // Utiliser Sharp pour valider et retraiter l'image
            try {
              const validatedBuffer = await sharp(rawBuffer)
                .png()
                .toBuffer();
              
              images.push(validatedBuffer);
              this.logger.log(`Page ${pageNum} validated with Sharp: ${validatedBuffer.length} bytes`);
            } catch (sharpError) {
              this.logger.error(`Sharp validation failed for page ${pageNum}: ${sharpError.message}`);
              // Essayer quand même avec le buffer brut
              if (rawBuffer && rawBuffer.length > 0) {
                images.push(rawBuffer);
                this.logger.warn(`Using raw buffer for page ${pageNum} despite Sharp error`);
              }
            }
          } else {
            // Fallback: chercher le fichier généré
            const expectedPath = path.join(tempDir, `page.${pageNum}.png`);
            this.logger.log(`Trying fallback path: ${expectedPath}`);
            
            if (fs.existsSync(expectedPath)) {
              const rawBuffer = fs.readFileSync(expectedPath);
              
              try {
                const validatedBuffer = await sharp(rawBuffer)
                  .png()
                  .toBuffer();
                
                images.push(validatedBuffer);
                this.logger.log(`Page ${pageNum} validated (fallback): ${validatedBuffer.length} bytes`);
              } catch (sharpError) {
                this.logger.error(`Sharp validation failed (fallback) for page ${pageNum}: ${sharpError.message}`);
              }
            } else {
              this.logger.warn(`Page ${pageNum}: Image file not found at ${expectedPath}`);
            }
          }
        } catch (error: any) {
          this.logger.error(`Failed to convert page ${pageNum}: ${error.message}`, error.stack);
        }
      }

      // Nettoyer les fichiers temporaires
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger.warn(`Failed to cleanup temp directory: ${cleanupError.message}`);
      }

      if (images.length === 0) {
        throw new BadRequestException('Failed to extract any images from PDF');
      }

      return images;
    } catch (error: any) {
      this.logger.error(`Error converting PDF to images: ${error.message}`);
      
      if (error.message.includes('Cannot find module') || error.code === 'MODULE_NOT_FOUND') {
        throw new BadRequestException(
          'pdf2pic is required for PDF processing. Please install it: npm install pdf2pic pdf-lib. ' +
          'Also ensure GraphicsMagick or ImageMagick is installed on your system.'
        );
      }
      
      throw new BadRequestException(
        `Failed to convert PDF to images: ${error.message}. ` +
        'Make sure GraphicsMagick or ImageMagick is installed: brew install graphicsmagick (macOS) or sudo apt-get install graphicsmagick (Linux)'
      );
    }
  }

  /**
   * Appelle Hugging Face OCR pour extraire le texte d'une image (fallback uniquement)
   * Note: Le modèle microsoft/trocr-small-printed n'est pas disponible via l'API Inference.
   * Cette méthode est conservée pour compatibilité mais utilise Tesseract.js par défaut.
   */
  async callHuggingFaceOCR(imageBuffer: Buffer): Promise<string> {
    try {
      if (!this.hf) {
        throw new BadRequestException('Hugging Face OCR not initialized. Check HF_API_KEY in environment variables.');
      }

      this.logger.log(`Calling Hugging Face OCR with model ${this.OCR_MODEL}...`);

      // Convertir le Buffer en ArrayBuffer pour l'API Hugging Face
      // Créer un nouveau ArrayBuffer pour éviter les problèmes de type
      const arrayBuffer = new ArrayBuffer(imageBuffer.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < imageBuffer.length; i++) {
        view[i] = imageBuffer[i];
      }

      // Appeler l'API Hugging Face pour l'OCR
      // Note: Le modèle microsoft/trocr-small-printed n'est pas disponible via l'API Inference
      // On essaie quand même au cas où un autre modèle serait configuré
      const result = await this.hf.imageToText({
        model: this.OCR_MODEL,
        data: arrayBuffer as ArrayBuffer,
      });

      // Le résultat de imageToText est une chaîne de caractères directement
      let extractedText: string;
      if (typeof result === 'string') {
        extractedText = result;
      } else if (result && typeof result === 'object' && 'text' in result) {
        extractedText = (result as any).text;
      } else {
        // Essayer de parser le résultat
        extractedText = JSON.stringify(result);
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw new BadRequestException('OCR returned empty result. The image may be too blurry or contain no text.');
      }

      extractedText = extractedText.trim();
      this.logger.log(`Hugging Face OCR extracted ${extractedText.length} characters`);
      
      // Log les 500 premiers caractères pour debug
      if (extractedText.length > 0) {
        this.logger.debug(`OCR text preview: ${extractedText.substring(0, Math.min(500, extractedText.length))}...`);
      }

      return extractedText;
    } catch (error: any) {
      this.logger.error(`Hugging Face OCR error: ${error.message}`, error.stack);
      
      // Si le modèle n'est pas disponible, indiquer clairement l'erreur
      if (error.message?.includes('No Inference Provider') || error.message?.includes('not available')) {
        throw new BadRequestException(
          `Le modèle ${this.OCR_MODEL} n'est pas disponible via l'API Inference de Hugging Face. ` +
          `Utilisez Tesseract.js (déjà configuré) qui fonctionne localement.`
        );
      }
      
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        throw new BadRequestException('Invalid or missing HF_API_KEY. Please check your environment variables.');
      }
      
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        throw new BadRequestException('Hugging Face API rate limit exceeded. Please try again later.');
      }
      
      throw new BadRequestException(`OCR failed: ${error.message}`);
    }
  }

  /**
   * Appelle Tesseract.js pour l'OCR local
   */
  async callTesseractOCR(imageBuffer: Buffer): Promise<string> {
    let tempImagePath: string | null = null;
    
    try {
      this.logger.log('Starting Tesseract OCR...');
      
      // Créer un fichier temporaire pour l'image
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
      tempImagePath = path.join(tempDir, 'image.png');
      
      // Sauvegarder le buffer dans un fichier temporaire
      fs.writeFileSync(tempImagePath, imageBuffer);
      
      // Créer un worker Tesseract avec support français et anglais
      const worker = await createWorker('fra+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            this.logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });
      
      // Effectuer l'OCR sur le fichier temporaire
      const { data: { text } } = await worker.recognize(tempImagePath);
      
      // Terminer le worker
      await worker.terminate();
      
      // Nettoyer le fichier temporaire
      try {
        if (tempImagePath && fs.existsSync(tempImagePath)) {
          fs.unlinkSync(tempImagePath);
          fs.rmdirSync(path.dirname(tempImagePath));
        }
      } catch (cleanupError) {
        this.logger.warn(`Failed to cleanup temp file: ${cleanupError.message}`);
      }
      
      if (!text || text.trim().length === 0) {
        throw new BadRequestException('OCR returned empty result');
      }
      
      this.logger.log(`Tesseract OCR extracted ${text.length} characters`);
      // Log les 500 premiers caractères pour debug
      if (text.length > 0) {
        this.logger.debug(`OCR text preview: ${text.substring(0, Math.min(500, text.length))}...`);
      }
      return text;
    } catch (error: any) {
      // Nettoyer en cas d'erreur
      if (tempImagePath && fs.existsSync(tempImagePath)) {
        try {
          fs.unlinkSync(tempImagePath);
          fs.rmdirSync(path.dirname(tempImagePath));
        } catch {}
      }
      
      this.logger.error(`Tesseract OCR error: ${error.message}`);
      throw new BadRequestException(`OCR failed: ${error.message}`);
    }
  }

  /**
   * Parse le texte OCR en JSON structuré
   */
  parseScheduleTextToJSON(text: string): Course[] {
    // D'abord essayer le parser spécifique ESPRIT
    const espritCourses = this.parseESPRITSchedule(text);
    if (espritCourses.length > 0) {
      return espritCourses;
    }

    // Sinon, utiliser le parser générique
    const courses: Course[] = [];

    // Nettoyer le texte
    let cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Normaliser les espaces multiples
    cleanedText = cleanedText.replace(/[ \t]+/g, ' ');

    // Détecter les lignes de cours
    const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    let currentDay: string | null = null;
    let currentCourse: Partial<Course> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Détecter un jour
      const dayMatch = this.detectDay(line);
      if (dayMatch) {
        // Sauvegarder le cours précédent s'il existe
        if (currentCourse && currentDay) {
          courses.push(this.completeCourse(currentCourse, currentDay));
        }
        currentDay = dayMatch;
        currentCourse = null;
        continue;
      }

      // Détecter une heure (format HH:MM ou HHhMM)
      const timeMatch = this.detectTime(line);
      if (timeMatch) {
        if (currentCourse && currentDay) {
          courses.push(this.completeCourse(currentCourse, currentDay));
        }
        currentCourse = {
          start: timeMatch.start,
          end: timeMatch.end,
        };
        continue;
      }

      // Si on a un cours en cours, essayer d'extraire matière, salle
      if (currentCourse && currentDay) {
        this.extractCourseDetails(line, currentCourse);
      } else if (!currentDay) {
        // Essayer de détecter un jour dans cette ligne
        const dayInLine = this.detectDay(line);
        if (dayInLine) {
          currentDay = dayInLine;
        }
      }
    }

    // Ajouter le dernier cours
    if (currentCourse && currentDay) {
      courses.push(this.completeCourse(currentCourse, currentDay));
    }

    // Si aucun cours n'a été trouvé avec la méthode précédente, essayer une approche globale
    if (courses.length === 0) {
      return this.parseScheduleAlternative(cleanedText);
    }

    return courses;
  }

  /**
   * Détecte un jour dans une ligne de texte
   */
  private detectDay(line: string): string | null {
    const lowerLine = line.toLowerCase().trim();
    
    // DEBUG: Log pour voir les lignes testées
    if (lowerLine.includes('lundi') || lowerLine.includes('mardi') || 
        lowerLine.includes('mercredi') || lowerLine.includes('jeudi') || 
        lowerLine.includes('vendredi') || lowerLine.includes('samedi') ||
        lowerLine.includes('monday') || lowerLine.includes('tuesday')) {
      this.logger.debug(`🔍 Testing line for day: "${lowerLine}"`);
    }

    // Vérifier les jours français (avec regex pour plus de précision)
    for (const [frenchDay, englishDay] of Object.entries(this.dayMapping)) {
      // Utiliser regex pour matcher le jour comme mot entier ou au début de ligne
      const dayRegex = new RegExp(`\\b${frenchDay}\\b|^${frenchDay}`, 'i');
      if (dayRegex.test(lowerLine)) {
        this.logger.debug(`✅ DAY DETECTED: "${englishDay}" from line: "${lowerLine}"`);
        return englishDay;
      }
    }

    // Vérifier les jours anglais
    for (const englishDay of this.englishDays) {
      const dayRegex = new RegExp(`\\b${englishDay}\\b|^${englishDay}`, 'i');
      if (dayRegex.test(lowerLine)) {
        this.logger.debug(`✅ DAY DETECTED: "${englishDay}" from line: "${lowerLine}"`);
        return englishDay;
      }
    }

    return null;
  }

  /**
   * Détecte les heures dans une ligne (format HH:MM-HH:MM ou HHhMM-HHhMM)
   */
  private detectTime(line: string): { start: string; end: string } | null {
    // Pattern 1: HH:MM - HH:MM ou HH:MM-HH:MM
    const pattern1 = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/;
    let match = line.match(pattern1);
    if (match) {
      return {
        start: `${match[1].padStart(2, '0')}:${match[2]}`,
        end: `${match[3].padStart(2, '0')}:${match[4]}`,
      };
    }

    // Pattern 2: HHhMM - HHhMM
    const pattern2 = /(\d{1,2})h(\d{2})\s*[-–—]\s*(\d{1,2})h(\d{2})/;
    match = line.match(pattern2);
    if (match) {
      return {
        start: `${match[1].padStart(2, '0')}:${match[2]}`,
        end: `${match[3].padStart(2, '0')}:${match[4]}`,
      };
    }

    // Pattern 3: HH:MM à HH:MM (format français)
    const pattern3 = /(\d{1,2}):(\d{2})\s*[àa]\s*(\d{1,2}):(\d{2})/;
    match = line.match(pattern3);
    if (match) {
      return {
        start: `${match[1].padStart(2, '0')}:${match[2]}`,
        end: `${match[3].padStart(2, '0')}:${match[4]}`,
      };
    }

    return null;
  }

  /**
   * Extrait les détails du cours (matière, salle) depuis une ligne
   */
  private extractCourseDetails(line: string, course: Partial<Course>): void {
    // Si le sujet n'est pas encore défini, cette ligne pourrait être le sujet
    if (!course.subject) {
      // Exclure les patterns qui ne sont pas des sujets
      if (!this.detectTime(line) && !this.detectDay(line)) {
        course.subject = line;
      }
      return;
    }

    // Détecter une salle (souvent avec des lettres et chiffres comme A23, B101, etc.)
    const classroomMatch = line.match(/\b([A-Z]\d{2,3}|[A-Z]-\d{2,3}|\d{3}[A-Z]?)\b/);
    if (classroomMatch && !course.classroom) {
      course.classroom = classroomMatch[1];
    }
  }

  /**
   * Complète un cours avec le jour et des valeurs par défaut
   */
  private completeCourse(course: Partial<Course>, day: string): Course {
    return {
      day: day,
      start: course.start || '00:00',
      end: course.end || '00:00',
      subject: course.subject || 'Unknown',
      classroom: course.classroom,
    };
  }

  /**
   * Méthode alternative de parsing si la méthode principale ne fonctionne pas
   */
  private parseScheduleAlternative(text: string): Course[] {
    const courses: Course[] = [];

    // Essayer de trouver tous les patterns de temps et de jours
    const timePattern = /(\d{1,2}):(\d{2})\s*[-–—àa]\s*(\d{1,2}):(\d{2})/g;
    const times: Array<{ start: string; end: string; index: number }> = [];

    let match;
    while ((match = timePattern.exec(text)) !== null) {
      times.push({
        start: `${match[1].padStart(2, '0')}:${match[2]}`,
        end: `${match[3].padStart(2, '0')}:${match[4]}`,
        index: match.index,
      });
    }

    // Pour chaque heure trouvée, chercher le jour le plus proche et les détails
    for (const time of times) {
      // Trouver le jour le plus proche avant cette heure
      let closestDay: string | null = null;
      let closestDayIndex = -1;

      for (const [frenchDay, englishDay] of Object.entries(this.dayMapping)) {
        const dayIndex = text.toLowerCase().lastIndexOf(frenchDay, time.index);
        if (dayIndex > closestDayIndex) {
          closestDayIndex = dayIndex;
          closestDay = englishDay;
        }
      }

      for (const englishDay of this.englishDays) {
        const dayIndex = text.toLowerCase().lastIndexOf(englishDay.toLowerCase(), time.index);
        if (dayIndex > closestDayIndex) {
          closestDayIndex = dayIndex;
          closestDay = englishDay;
        }
      }

      // Extraire le texte autour de cette heure
      // Estimer la longueur du pattern (HH:MM - HH:MM = ~13 caractères)
      const patternLength = time.start.length + time.end.length + 3; // +3 pour " - "
      const contextStart = Math.max(0, time.index - 50);
      const contextEnd = Math.min(text.length, time.index + patternLength + 100);
      const context = text.substring(contextStart, contextEnd);

      const course: Course = {
        day: closestDay || 'Unknown',
        start: time.start,
        end: time.end,
        subject: this.extractSubject(context),
        classroom: this.extractClassroom(context),
      };

      courses.push(course);
    }

    return courses;
  }

  /**
   * Extrait le sujet depuis un contexte
   */
  private extractSubject(context: string): string {
    // Supprimer les heures et jours
    let cleaned = context.replace(/\d{1,2}[:h]\d{2}/g, '').trim();
    
    // Prendre les premiers mots significatifs
    const words = cleaned.split(/\s+/).filter(w => w.length > 2);
    return words.slice(0, 3).join(' ') || 'Unknown';
  }

  /**
   * Extrait la salle depuis un contexte
   */
  private extractClassroom(context: string): string | undefined {
    const match = context.match(/\b([A-Z]\d{2,3}|[A-Z]-\d{2,3})\b/);
    return match ? match[1] : undefined;
  }

  /**
   * Nettoie et corrige les erreurs OCR communes
   */
  private cleanOCRText(text: string): string {
    return text
      // Corriger les erreurs OCR communes
      .replace(/Développment/g, 'Développement')
      .replace(/veloppment/g, 'Développement')
      .replace(/êve oppment/g, 'Développement')
      .replace(/Entreuprenariat/g, 'Entrepreneuriat')
      .replace(/Citoyenneté/g, 'Citoyenneté')
      .replace(/Architecture des SI Il/g, 'Architecture des SI II')
      .replace(/Innovation & Entr[^/]*/g, 'Innovation & Entrepreneuriat')
      .replace(/Ideation Camp/g, 'Innovation & Entrepreneuriat_Ideation Camp')
      // Nettoyer les fragments parasites
      .replace(/De Css ei/g, '')
      .replace(/\? pation obile/g, '')
      .replace(/[PÀaUSEFes]{1,3}\s*$/gm, '') // Enlever les caractères isolés en fin de ligne
      .replace(/^\s*[PÀaUSEFes]{1,3}\s*/gm, '') // Enlever les caractères isolés en début de ligne
      // Normaliser les espaces MAIS GARDER LES RETOURS À LA LIGNE
      .replace(/[ \t]+/g, ' ') // Remplacer seulement les espaces/tabs par un espace
      .replace(/\n\s*\n/g, '\n') // Supprimer les lignes vides multiples
      .trim();
  }

  /**
   * Reconstruit les noms de cours fragmentés
   */
  private reconstructCourseName(lines: string[], startIndex: number, maxLines: number = 3): string | null {
    let courseName = '';
    let foundStart = false;
    
    for (let i = startIndex; i >= Math.max(0, startIndex - maxLines); i--) {
      const line = lines[i].trim();
      
      // Ignorer les dates, jours, horaires
      if (line.match(/^\d{2}\/\d{2}\/\d{4}/) || 
          this.detectDay(line) || 
          line.match(/\d{1,2}H:\d{2}/) ||
          line.length < 3) {
        if (foundStart) break; // On a trouvé le début, arrêter
        continue;
      }
      
      // Si on trouve un nom de cours valide
      if (line.match(/[A-Za-z]{3,}/) && !line.match(/^[A-Z]\d{2,3}$/)) {
        courseName = line + (courseName ? ' ' + courseName : '');
        foundStart = true;
      }
    }
    
    return courseName.length > 5 ? this.cleanOCRText(courseName) : null;
  }

  /**
   * Parser spécifique pour le format ESPRIT (tableau avec horaires en colonnes)
   * Amélioré pour gérer le format tabulaire avec colonnes par jour
   */
  private parseESPRITSchedule(text: string): Course[] {
    const courses: Course[] = [];
    // Nettoyer le texte OCR d'abord
    const cleanedText = this.cleanOCRText(text);
    const lines = cleanedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Trouver la ligne avec les jours de la semaine
    let daysLineIndex = -1;
    const daysOrder: string[] = [];
    const dayPositions: Map<string, number> = new Map();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      // Chercher une ligne contenant plusieurs jours
      const foundDays: string[] = [];
      for (const [frenchDay, englishDay] of Object.entries(this.dayMapping)) {
        if (line.includes(frenchDay)) {
          foundDays.push(englishDay);
          // Estimer la position du jour dans la ligne originale
          const pos = lines[i].toLowerCase().indexOf(frenchDay);
          if (pos !== -1) {
            dayPositions.set(englishDay, pos);
          }
        }
      }
      
      if (foundDays.length >= 3) {
        // C'est probablement la ligne des jours
        daysLineIndex = i;
        daysOrder.push(...foundDays);
        this.logger.debug(`📅 Found days line at index ${i}: ${foundDays.join(', ')}`);
        break;
      }
    }
    
    if (daysLineIndex === -1 || daysOrder.length === 0) {
      this.logger.warn('Could not find days line, using fallback parser');
      return this.parseESPRITScheduleFallback(cleanedText, lines);
    }
    
    // Nouvelle approche : trouver les lignes avec plusieurs horaires identiques (format tabulaire)
    // Ces lignes représentent le même créneau horaire pour différents jours
    const timePattern = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
    
    // Parcourir les lignes pour trouver celles avec plusieurs horaires
    for (let i = daysLineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      
      // Chercher tous les horaires dans cette ligne
      const timeMatches: Array<{ start: string; end: string; index: number }> = [];
      let match;
      while ((match = timePattern.exec(line)) !== null) {
        timeMatches.push({
          start: `${match[1].padStart(2, '0')}:${match[2]}`,
          end: `${match[3].padStart(2, '0')}:${match[4]}`,
          index: match.index,
        });
      }
      
      // Si on trouve plusieurs horaires identiques sur la même ligne, c'est un créneau horaire pour plusieurs jours
      if (timeMatches.length >= 2) {
        // Vérifier que tous les horaires sont identiques (même créneau)
        const firstTime = `${timeMatches[0].start}-${timeMatches[0].end}`;
        const allSame = timeMatches.every(t => `${t.start}-${t.end}` === firstTime);
        
        if (allSame) {
          // C'est un créneau horaire qui se répète pour plusieurs jours
          const timeSlot = { start: timeMatches[0].start, end: timeMatches[0].end };
          
          // Chercher les noms de cours dans les lignes précédentes (2-6 lignes avant)
          // Les cours sont généralement sur des lignes séparées au-dessus des horaires
          const courseLines: Array<{ line: string; index: number }> = [];
          for (let j = Math.max(daysLineIndex + 1, i - 6); j < i; j++) {
            const prevLine = lines[j].trim();
            // Ignorer les lignes avec horaires, jours, dates, heures (09h, 10h), salles seules
            if (!prevLine.match(/\d{1,2}:\d{2}/) && 
                !this.detectDay(prevLine) && 
                !prevLine.match(/^\d{2}\/\d{2}\/\d{4}/) &&
                !prevLine.match(/^\d{1,2}h$/i) &&
                !prevLine.match(/^[—-]+$/) &&
                !prevLine.match(/^[A-Z]\d{2,3}$/) &&
                prevLine.length > 3 &&
                prevLine.match(/[A-Za-z]{3,}/)) {
              courseLines.push({ line: prevLine, index: j });
            }
          }
          
          // Extraire les noms de cours depuis ces lignes
          const courseNames: string[] = [];
          
          // Si on a plusieurs lignes, elles peuvent contenir plusieurs cours ou un cours multi-lignes
          if (courseLines.length > 0) {
            // Analyser chaque ligne pour extraire les cours
            for (const courseLine of courseLines) {
              const line = courseLine.line;
              
              // Si la ligne contient plusieurs mots en majuscules séparés par des espaces
              // (ex: "EN PE PROCEDURAL PROGRAMMING 1 ALGORITHMIC 1 PHOTO AND VIDEO EDITING")
              // Essayer de les séparer en cours individuels
              
              // Pattern amélioré : Chercher des séquences de mots en majuscules
              // Ex: "PROCEDURAL PROGRAMMING 1", "ALGORITHMIC 1", "PHOTO AND VIDEO EDITING"
              // Les cours sont généralement séparés par des espaces et commencent par des majuscules
              
              // Essayer de séparer par des patterns spécifiques
              // Pattern 1: Mots en majuscules suivis de "1" ou "F1" ou similaires
              // Pattern 2: Séquences de 2+ mots en majuscules
              
              // Séparer d'abord par des patterns comme "1 " suivi d'un nouveau mot en majuscules
              // ou par des séquences de mots en majuscules séparées par des espaces
              const parts = line.split(/\s+(?=[A-Z]{3,}\s+[A-Z])/); // Séparer avant un mot en majuscules suivi d'un autre
              
              // Si ça ne fonctionne pas, essayer une autre approche
              if (parts.length <= 1) {
                // Chercher des patterns comme "WORD WORD 1" ou "WORD WORD WORD"
                const coursePattern = /([A-Z][A-Z\s,&]+?(?:\s+\d+)?(?:\s+[A-Z]{2,})?)/g;
                let match;
                const foundCourses: string[] = [];
                
                while ((match = coursePattern.exec(line)) !== null) {
                  const course = match[1].trim();
                  // Filtrer les cours valides
                  if (course.length >= 5 && 
                      !course.match(/^[A-Z]{1,2}$/) &&
                      !course.match(/^[A-Z]\d{2,3}$/) &&
                      course.split(/\s+/).length >= 2) { // Au moins 2 mots
                    foundCourses.push(course);
                  }
                }
                
                if (foundCourses.length > 1) {
                  // Plusieurs cours trouvés
                  courseNames.push(...foundCourses);
                } else if (foundCourses.length === 1) {
                  // Un seul cours trouvé, mais la ligne peut en contenir plusieurs
                  // Essayer de séparer manuellement
                  const words = line.split(/\s+/);
                  const courses: string[] = [];
                  let currentCourse: string[] = [];
                  
                  for (let w = 0; w < words.length; w++) {
                    const word = words[w];
                    // Si le mot est un chiffre seul ou "F1", "APP", etc., c'est la fin d'un cours
                    if (word.match(/^\d+$|^[A-Z]{2,3}$/) && currentCourse.length > 0) {
                      currentCourse.push(word);
                      courses.push(currentCourse.join(' '));
                      currentCourse = [];
                    } else if (word.match(/^[A-Z]{3,}/)) {
                      // Nouveau mot en majuscules
                      if (currentCourse.length > 0 && word.length > 3) {
                        // Peut-être le début d'un nouveau cours
                        courses.push(currentCourse.join(' '));
                        currentCourse = [word];
                      } else {
                        currentCourse.push(word);
                      }
                    } else {
                      currentCourse.push(word);
                    }
                  }
                  
                  if (currentCourse.length > 0) {
                    courses.push(currentCourse.join(' '));
                  }
                  
                  if (courses.length > 1) {
                    courseNames.push(...courses.filter(c => c.length >= 5));
                  } else {
                    courseNames.push(foundCourses[0]);
                  }
                } else {
                  // Pas de pattern trouvé, passer à la méthode suivante
                }
              } else {
                // On a des parties séparées
                for (const part of parts) {
                  const cleaned = part.trim();
                  if (cleaned.length >= 5 && cleaned.match(/[A-Za-z]{3,}/)) {
                    courseNames.push(cleaned);
                  }
                }
              }
              
              // Si toujours pas de cours trouvés, essayer autrement
              if (courseNames.length === 0) {
                // Si pas de pattern trouvé, essayer de séparer par espaces multiples ou mots en majuscules
                // Ex: "PROCEDURAL PROGRAMMING 1 ALGORITHMIC 1" -> ["PROCEDURAL PROGRAMMING 1", "ALGORITHMIC 1"]
                const words = line.split(/\s{2,}/); // Séparer par espaces doubles ou plus
                if (words.length > 1) {
                  for (const word of words) {
                    const cleaned = word.trim();
                    if (cleaned.length >= 5 && cleaned.match(/[A-Za-z]{3,}/)) {
                      courseNames.push(cleaned);
                    }
                  }
                } else {
                  // Une seule ligne, peut être un cours complet ou incomplet
                  // Si la ligne se termine par "AND", "OF", "THE", etc., c'est peut-être incomplet
                  if (line.match(/\b(AND|OF|THE|CULTURE|CITIZENSHIP)\s*$/i) || 
                      (line.length < 25 && line.match(/[A-Z]{3,}/))) {
                    // Chercher la suite dans les lignes précédentes ET suivantes
                    let completeCourse = line;
                    
                    // D'abord chercher dans les lignes précédentes (pour les cours qui continuent)
                    for (let k = Math.max(daysLineIndex + 1, courseLine.index - 2); k < courseLine.index; k++) {
                      const prevLine = lines[k].trim();
                      if (prevLine.length > 3 && 
                          !prevLine.match(/\d{1,2}:\d{2}/) &&
                          !prevLine.match(/^[A-Z]\d{2,3}$/) &&
                          prevLine.match(/[A-Za-z]{3,}/)) {
                        // Vérifier si c'est la suite (commence par des mots en majuscules)
                        if (prevLine.match(/^[A-Z]/)) {
                          completeCourse = prevLine + ' ' + completeCourse;
                          break;
                        }
                      }
                    }
                    
                    // Ensuite chercher dans les lignes suivantes
                    for (let k = courseLine.index + 1; k < Math.min(lines.length, courseLine.index + 3); k++) {
                      const nextLine = lines[k].trim();
                      if (nextLine.length > 3 && 
                          !nextLine.match(/\d{1,2}:\d{2}/) &&
                          !nextLine.match(/^[A-Z]\d{2,3}$/) &&
                          !nextLine.match(/^[A-Z]{3,}\s+[A-Z]{3,}/)) { // Pas un nouveau cours
                        completeCourse += ' ' + nextLine;
                        break;
                      }
                    }
                    
                    if (completeCourse.length >= 10) {
                      courseNames.push(completeCourse);
                    } else {
                      // Si toujours trop court, prendre quand même
                      courseNames.push(line);
                    }
                  } else {
                    // Cours complet sur une ligne
                    courseNames.push(line);
                  }
                }
              }
            }
          }
          
          // Nettoyer et valider les noms de cours
          const cleanedCourseNames = courseNames
            .map(name => name
              .replace(/\/$/, '')
              .replace(/^[;\s.]+/, '')
              .replace(/[;\s.]+$/, '')
              .trim())
            .filter(name => 
              name.length >= 5 && 
              !name.match(/^[A-Z]\d{2,3}$/) &&
              !name.match(/^\d{2}\/\d{2}\/\d{4}/) &&
              !this.detectDay(name) &&
              !name.match(/^[—-]+$/) &&
              name.match(/[A-Za-z]{3,}/)
            );
          
          // Utiliser les cours nettoyés
          courseNames.length = 0;
          courseNames.push(...cleanedCourseNames);
          
          // Chercher la salle (généralement sur la même ligne ou ligne suivante)
          let classroom: string | undefined;
          const classroomMatch = line.match(/\b([A-Z]\d{2,3}|En Ligne)\b/i);
          if (classroomMatch) {
            classroom = classroomMatch[1];
          } else {
            // Chercher dans les lignes autour
            for (let j = Math.max(0, i - 2); j < Math.min(lines.length, i + 2); j++) {
              const nearLine = lines[j];
              const cm = nearLine.match(/\b([A-Z]\d{2,3}|En Ligne)\b/i);
              if (cm) {
                classroom = cm[1];
                break;
              }
            }
          }
          
          // Associer chaque cours trouvé aux jours dans l'ordre
          // Le nombre d'horaires correspond au nombre de jours avec cours
          // On associe les cours dans l'ordre trouvé aux jours dans l'ordre (en sautant les jours sans cours)
          const numTimeSlots = timeMatches.length;
          
          // Filtrer les jours qui ont probablement des cours (en se basant sur le nombre d'horaires)
          // Si on a 4 horaires, on a probablement 4 jours avec cours (Lundi, Mardi, Jeudi, Vendredi)
          const daysWithCourses: string[] = [];
          let dayIndex = 0;
          for (let slotIdx = 0; slotIdx < numTimeSlots && dayIndex < daysOrder.length; dayIndex++) {
            const day = daysOrder[dayIndex];
            // Ajouter le jour (on suppose que tous les jours jusqu'au nombre d'horaires ont des cours)
            daysWithCourses.push(day);
            slotIdx++;
          }
          
          // Si on a plus de cours que de jours, prendre seulement les premiers
          // Si on a moins de cours que de jours, certains jours n'ont pas de cours (normal)
          const numCoursesToAssign = Math.min(courseNames.length, daysWithCourses.length);
          
          // Associer les cours aux jours
          for (let courseIdx = 0; courseIdx < numCoursesToAssign; courseIdx++) {
            let subject = courseNames[courseIdx];
            
            // Nettoyer le nom du cours
            subject = subject
              .replace(/\/$/, '')
              .replace(/^[;\s.]+/, '')
              .replace(/[;\s.]+$/, '')
              .trim();
            
            // Valider le sujet
            if (subject && 
                subject.length >= 5 && 
                !subject.match(/^[A-Z]\d{2,3}$/) &&
                !subject.match(/^\d{2}\/\d{2}\/\d{4}/) &&
                !this.detectDay(subject) &&
                !subject.match(/^[—-]+$/)) {
              
              subject = this.cleanOCRText(subject);
              
              const day = daysWithCourses[courseIdx];
              
              courses.push({
                day: day,
                start: timeSlot.start,
                end: timeSlot.end,
                subject: subject,
                classroom: classroom,
              });
              
              this.logger.debug(`✅ Found course: ${subject} on ${day} at ${timeSlot.start}-${timeSlot.end} in ${classroom || 'unknown room'}`);
            }
          }
          
          // Si on a des horaires mais pas assez de cours trouvés, 
          // essayer de trouver les cours manquants dans d'autres lignes
          if (numCoursesToAssign < daysWithCourses.length && courseNames.length < numTimeSlots) {
            this.logger.debug(`⚠️ Found ${numTimeSlots} time slots but only ${courseNames.length} course names. Searching for more...`);
            
            // Chercher dans une zone plus large
            for (let j = Math.max(daysLineIndex + 1, i - 10); j < i && courseNames.length < numTimeSlots; j++) {
              const searchLine = lines[j].trim();
              
              // Ignorer les lignes déjà traitées ou invalides
              if (searchLine.length > 5 && 
                  searchLine.match(/[A-Za-z]{5,}/) &&
                  !searchLine.match(/\d{1,2}:\d{2}/) &&
                  !this.detectDay(searchLine) &&
                  !searchLine.match(/^[A-Z]\d{2,3}$/) &&
                  !courseLines.some(cl => cl.index === j)) {
                
                // Vérifier si cette ligne contient un cours qu'on n'a pas encore
                const isNewCourse = !courseNames.some(cn => 
                  searchLine.includes(cn) || cn.includes(searchLine)
                );
                
                if (isNewCourse) {
                  let subject = searchLine
                    .replace(/\/$/, '')
                    .replace(/^[;\s.]+/, '')
                    .replace(/[;\s.]+$/, '')
                    .trim();
                  
                  if (subject.length >= 5) {
                    subject = this.cleanOCRText(subject);
                    courseNames.push(subject);
                    
                    // Associer ce nouveau cours au prochain jour disponible
                    if (courseNames.length <= daysWithCourses.length) {
                      const day = daysWithCourses[courseNames.length - 1];
                      
                      courses.push({
                        day: day,
                        start: timeSlot.start,
                        end: timeSlot.end,
                        subject: subject,
                        classroom: classroom,
                      });
                      
                      this.logger.debug(`✅ Found additional course: ${subject} on ${day} at ${timeSlot.start}-${timeSlot.end}`);
                    }
                  }
                }
              }
            }
          }
          
          // Si on n'a pas trouvé de noms de cours mais qu'on a des horaires, 
          // chercher dans les lignes précédentes de manière plus large
          if (courseNames.length === 0) {
            // Chercher dans une zone plus large (5-10 lignes avant)
            for (let j = Math.max(daysLineIndex + 1, i - 10); j < i; j++) {
              const searchLine = lines[j].trim();
              if (searchLine.length > 10 && 
                  searchLine.match(/[A-Za-z]{5,}/) &&
                  !searchLine.match(/\d{1,2}:\d{2}/) &&
                  !this.detectDay(searchLine)) {
                
                let subject = searchLine
                  .replace(/\/$/, '')
                  .replace(/^[;\s.]+/, '')
                  .replace(/[;\s.]+$/, '')
                  .trim();
                
                if (subject.length >= 5) {
                  subject = this.cleanOCRText(subject);
                  
                  // Associer au premier jour disponible (approximation)
                  const day = daysWithCourses[0] || daysOrder[0];
                  
                  courses.push({
                    day: day,
                    start: timeSlot.start,
                    end: timeSlot.end,
                    subject: subject,
                    classroom: classroom,
                  });
                  
                  this.logger.debug(`✅ Found course (fallback): ${subject} on ${day} at ${timeSlot.start}-${timeSlot.end}`);
                  break; // Prendre seulement le premier cours trouvé
                }
              }
            }
          }
        }
      } else if (timeMatches.length === 1) {
        // Un seul horaire sur la ligne - peut être un cours isolé
        // Utiliser la méthode précédente pour l'associer à un jour
        const timeSlot = { start: timeMatches[0].start, end: timeMatches[0].end };
        
        // Chercher le nom du cours
        let subject = '';
        for (let j = Math.max(daysLineIndex + 1, i - 5); j < i; j++) {
          const prevLine = lines[j].trim();
          if (prevLine.length > 10 && 
              prevLine.match(/[A-Za-z]{5,}/) &&
              !prevLine.match(/\d{1,2}:\d{2}/) &&
              !this.detectDay(prevLine)) {
            subject = prevLine;
            break;
          }
        }
        
        if (subject) {
          subject = this.cleanOCRText(subject
            .replace(/\/$/, '')
            .replace(/^[;\s.]+/, '')
            .replace(/[;\s.]+$/, '')
            .trim());
          
          // Chercher la salle
          let classroom: string | undefined;
          const classroomMatch = line.match(/\b([A-Z]\d{2,3}|En Ligne)\b/i);
          if (classroomMatch) {
            classroom = classroomMatch[1];
          }
          
          // Associer au jour le plus proche (approximation)
          const day = daysOrder[0] || 'Monday';
          
          if (subject.length >= 5) {
            courses.push({
              day: day,
              start: timeSlot.start,
              end: timeSlot.end,
              subject: subject,
              classroom: classroom,
            });
            
            this.logger.debug(`✅ Found single course: ${subject} on ${day} at ${timeSlot.start}-${timeSlot.end}`);
          }
        }
      }
    }
    
    // Si on n'a pas trouvé de cours avec horaires, utiliser le parser fallback
    if (courses.length === 0) {
      this.logger.warn('No courses found with time-based parsing, using fallback');
      return this.parseESPRITScheduleFallback(cleanedText, lines);
    }
    
    this.logger.log(`ESPRIT parser found ${courses.length} courses`);
    return courses;
  }
  
  /**
   * Helper pour obtenir la position approximative d'un caractère dans une ligne
   */
  private getCharPositionInLine(line: string, searchText: string): number {
    const index = line.indexOf(searchText);
    return index !== -1 ? index : line.length / 2; // Fallback au milieu si pas trouvé
  }
  
  /**
   * Parser fallback pour le format ESPRIT (méthode originale améliorée)
   * Utilisé si le parser principal ne trouve pas de cours
   */
  private parseESPRITScheduleFallback(text: string, lines: string[]): Course[] {
    const courses: Course[] = [];
    
    // Chercher tous les horaires dans le texte avec leur contexte
    const timePattern = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
    const timeSlots: Array<{ start: string; end: string; lineIndex: number; context: string }> = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;
      while ((match = timePattern.exec(line)) !== null) {
        const start = `${match[1].padStart(2, '0')}:${match[2]}`;
        const end = `${match[3].padStart(2, '0')}:${match[4]}`;
        
        // Créer un contexte autour de cet horaire (lignes précédentes et suivantes)
        const contextLines: string[] = [];
        for (let j = Math.max(0, i - 2); j < Math.min(lines.length, i + 3); j++) {
          contextLines.push(lines[j]);
        }
        const context = contextLines.join(' ');
        
        timeSlots.push({ start, end, lineIndex: i, context });
      }
    }
    
    // Pour chaque horaire, trouver le jour et le cours
    for (const timeSlot of timeSlots) {
      // Chercher le jour le plus proche dans le contexte
      let bestDay: string | null = null;
      let minDistance = Infinity;
      
      // Chercher dans les lignes avant l'horaire
      for (let i = Math.max(0, timeSlot.lineIndex - 10); i < timeSlot.lineIndex; i++) {
        const dayMatch = this.detectDay(lines[i]);
        if (dayMatch) {
          bestDay = dayMatch;
          break;
        }
      }
      
      // Si pas trouvé, chercher dans tout le texte avant
      if (!bestDay) {
        const textBefore = lines.slice(0, timeSlot.lineIndex).join(' ');
        for (const [frenchDay, englishDay] of Object.entries(this.dayMapping)) {
          if (textBefore.toLowerCase().includes(frenchDay)) {
            // Prendre le dernier jour trouvé (le plus proche)
            const lastIndex = textBefore.toLowerCase().lastIndexOf(frenchDay);
            if (lastIndex > minDistance) {
              minDistance = lastIndex;
              bestDay = englishDay;
            }
          }
        }
      }
      
      // Si toujours pas trouvé, utiliser une heuristique basée sur la position
      if (!bestDay) {
        // Chercher la ligne avec tous les jours
        for (let i = 0; i < Math.min(20, lines.length); i++) {
          const line = lines[i].toLowerCase();
          const daysInLine: string[] = [];
          for (const [frenchDay, englishDay] of Object.entries(this.dayMapping)) {
            if (line.includes(frenchDay)) {
              daysInLine.push(englishDay);
            }
          }
          if (daysInLine.length >= 3) {
            // Estimer la colonne en fonction de la position dans le texte
            const estimatedCol = Math.floor((timeSlot.lineIndex / lines.length) * daysInLine.length);
            bestDay = daysInLine[Math.min(estimatedCol, daysInLine.length - 1)];
            break;
          }
        }
      }
      
      if (!bestDay) {
        bestDay = 'Monday'; // Fallback
      }
      
      // Extraire le nom du cours depuis le contexte
      let subject = '';
      const contextLines = lines.slice(Math.max(0, timeSlot.lineIndex - 5), timeSlot.lineIndex + 1);
      
      // Chercher dans les lignes précédentes (en remontant)
      const subjectParts: string[] = [];
      for (let i = contextLines.length - 2; i >= 0; i--) {
        const line = contextLines[i].trim();
        // Ignorer les lignes avec horaires, jours, dates, salles seules, heures (09h, 10h, etc.)
        if (!line.match(/\d{1,2}:\d{2}/) && 
            !this.detectDay(line) && 
            !line.match(/^\d{2}\/\d{2}\/\d{4}/) &&
            !line.match(/^[A-Z]\d{2,3}$/) &&
            !line.match(/^\d{1,2}h$/i) &&
            line.length > 3 &&
            !line.match(/^[—-]+$/)) {
          
          // Si la ligne contient des mots en majuscules (probablement un nom de cours)
          if (line.match(/[A-Z]{3,}/) || line.length > 10) {
            subjectParts.unshift(line);
            // Arrêter si on a trouvé un nom de cours complet (plus de 15 caractères)
            if (subjectParts.join(' ').length > 15) {
              break;
            }
          }
        }
      }
      
      // Reconstruire le nom complet
      if (subjectParts.length > 0) {
        subject = subjectParts.join(' ');
      }
      
      // Si pas trouvé, chercher dans la ligne avec l'horaire
      if (!subject || subject.length < 5) {
        const lineWithTime = lines[timeSlot.lineIndex];
        const match = lineWithTime.match(/(.+?)\s+\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/);
        if (match) {
          subject = match[1].trim();
        }
      }
      
      // Si toujours pas trouvé, chercher dans les lignes suivantes (pour les cours qui continuent après l'horaire)
      if (!subject || subject.length < 5) {
        for (let i = timeSlot.lineIndex + 1; i < Math.min(lines.length, timeSlot.lineIndex + 3); i++) {
          const line = lines[i].trim();
          if (line.length > 5 && 
              !line.match(/\d{1,2}:\d{2}/) && 
              !this.detectDay(line) &&
              !line.match(/^[A-Z]\d{2,3}$/)) {
            subject = (subject ? subject + ' ' : '') + line;
            break;
          }
        }
      }
      
      // Nettoyer le sujet
      subject = subject
        .replace(/\/$/, '')
        .replace(/^[;\s.]+/, '')
        .replace(/[;\s.]+$/, '')
        .trim();
      
      // Si le sujet contient plusieurs cours (séparés par des espaces multiples ou patterns)
      // Essayer de les séparer
      if (subject.length > 30 && subject.match(/[A-Z]{3,}\s+[A-Z]{3,}/)) {
        // Probablement plusieurs cours sur une ligne
        // Pour l'instant, prendre le premier cours significatif
        const words = subject.split(/\s+/);
        const firstCourseWords: string[] = [];
        for (const word of words) {
          if (word.match(/^[A-Z]{3,}$/) && firstCourseWords.length < 5) {
            firstCourseWords.push(word);
          } else if (firstCourseWords.length > 0) {
            break;
          }
        }
        if (firstCourseWords.length > 0) {
          subject = firstCourseWords.join(' ');
        }
      }
      
      // Chercher la salle
      let classroom: string | undefined;
      for (let i = Math.max(0, timeSlot.lineIndex - 2); i < Math.min(lines.length, timeSlot.lineIndex + 3); i++) {
        const line = lines[i];
        const match = line.match(/\b([A-Z]\d{2,3}|En Ligne)\b/i);
        if (match) {
          classroom = match[1];
          break;
        }
      }
      
      // Valider et ajouter le cours
      if (subject && 
          subject.length >= 5 && 
          !subject.match(/^[A-Z]\d{2,3}$/) &&
          !subject.match(/^\d{2}\/\d{2}\/\d{4}/) &&
          !this.detectDay(subject)) {
        
        subject = this.cleanOCRText(subject);
        
        courses.push({
          day: bestDay,
          start: timeSlot.start,
          end: timeSlot.end,
          subject: subject,
          classroom: classroom,
        });
        
        this.logger.debug(`✅ Fallback: Found course ${subject} on ${bestDay} at ${timeSlot.start}-${timeSlot.end}`);
      }
    }
    
    return courses;
  }

  /**
   * Convertit les jours de la semaine en index (0 = Dimanche, 1 = Lundi, etc.)
   */
  private getDayIndex(dayName: string): number {
    const dayMap: { [key: string]: number } = {
      'Sunday': 0,
      'Monday': 1,
      'Tuesday': 2,
      'Wednesday': 3,
      'Thursday': 4,
      'Friday': 5,
      'Saturday': 6,
    };
    return dayMap[dayName] ?? 1; // Par défaut Lundi
  }

  /**
   * Calcule la date réelle pour un jour de la semaine donné
   * @param dayName Nom du jour (Monday, Tuesday, etc.)
   * @param weekStartDate Date de début de la semaine (ex: premier jour du semestre)
   */
  private calculateDateForDay(dayName: string, weekStartDate: Date): Date {
    const targetDayIndex = this.getDayIndex(dayName);
    const weekStartDayIndex = weekStartDate.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
    
    // Calculer le nombre de jours à ajouter
    let daysToAdd = targetDayIndex - weekStartDayIndex;
    if (daysToAdd < 0) {
      daysToAdd += 7; // Si le jour cible est dans la semaine suivante
    }
    
    const targetDate = new Date(weekStartDate);
    targetDate.setDate(weekStartDate.getDate() + daysToAdd);
    
    return targetDate;
  }

  /**
   * Crée automatiquement des événements à partir des cours extraits
   * @param courses Liste des cours extraits
   * @param userId ID de l'utilisateur
   * @param weekStartDate Date de début de la semaine (optionnel, par défaut: lundi de cette semaine)
   * @returns Liste des événements créés
   */
  async createEvenementsFromCourses(
    courses: Course[],
    userId: string,
    weekStartDate?: Date,
  ): Promise<EvenementDocument[]> {
    // Si pas de date fournie, utiliser le lundi de cette semaine
    if (!weekStartDate) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 0 = Dimanche
      weekStartDate = new Date(today);
      weekStartDate.setDate(today.getDate() + daysToMonday);
      weekStartDate.setHours(0, 0, 0, 0);
    }

    const evenements: EvenementDocument[] = [];

    for (const course of courses) {
      try {
        // Calculer la date réelle pour ce jour
        const eventDate = this.calculateDateForDay(course.day, weekStartDate);
        
        // Formater la date en ISO string (YYYY-MM-DD)
        const dateString = eventDate.toISOString().split('T')[0];

        // Créer l'événement
        const evenement = await this.evenementService.create(
          {
            titre: course.subject,
            type: EventType.COURS,
            date: dateString,
            heureDebut: course.start,
            heureFin: course.end,
            lieu: course.classroom || undefined,
            couleur: '#3B82F6', // Couleur par défaut bleue pour les cours
          },
          userId,
        );

        evenements.push(evenement);
        this.logger.log(`Événement créé: ${course.subject} le ${course.day} ${dateString}`);
      } catch (error) {
        this.logger.error(`Erreur lors de la création de l'événement pour ${course.subject}: ${error.message}`);
        // Continuer avec les autres cours même si un échoue
      }
    }

    this.logger.log(`${evenements.length}/${courses.length} événements créés avec succès`);
    return evenements;
  }
}
