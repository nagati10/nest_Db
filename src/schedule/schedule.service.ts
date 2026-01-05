import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EvenementService } from '../evenement/evenement.service';
import { EventType } from '../evenement/schemas/evenement.schema';
import { EvenementDocument } from '../evenement/schemas/evenement.schema';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

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
  // Tesseract.js pour OCR local (pas besoin de HF_API_KEY)
  private useTesseract = true;

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
    this.logger.log('ScheduleService initialized with Tesseract.js OCR');
  }

  /**
   * Traite un PDF d'emploi du temps complet
   */
  async processSchedulePDF(pdfBuffer: Buffer): Promise<ProcessedSchedule> {
    try {
      this.logger.log('Starting PDF processing...');

      // 1. Convertir PDF en images
      const images = await this.convertPdfToImages(pdfBuffer);
      this.logger.log(`PDF converted to ${images.length} images`);

      // 2. Traiter chaque image avec OCR
      let allText = '';
      for (let i = 0; i < images.length; i++) {
        this.logger.log(`Processing page ${i + 1}/${images.length}...`);
        const text = await this.callTesseractOCR(images[i]);
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
   * Utilise pdfjs-dist et canvas (pure JavaScript, pas besoin de GraphicsMagick)
   */
  async convertPdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
    try {
      this.logger.log('Converting PDF to images using pdfjs-dist...');
      
      // Importer pdfjs-dist v3.x (better Node.js support)
      // v3.x has reliable legacy build path
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      const { createCanvas } = require('canvas');

      // Charger le document PDF
      const loadingTask = pdfjsLib.getDocument({ 
        data: new Uint8Array(pdfBuffer),
        useSystemFonts: true,
      });
      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;

      this.logger.log(`PDF has ${numPages} pages`);

      const images: Buffer[] = [];
      // Higher scale for better OCR quality (4.0 = ~600 DPI, optimal for text recognition)
      const scale = 4.0;

      // Convertir chaque page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          this.logger.log(`Processing page ${pageNum}/${numPages}...`);
          
          // Obtenir la page
          const page = await pdfDocument.getPage(pageNum);
          const viewport = page.getViewport({ scale });

          // Créer un canvas avec les dimensions de la page
          const canvas = createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext('2d');

          // Améliorer la qualité de rendu pour OCR
          // Set white background for clean rendering
          context.fillStyle = 'white';
          context.fillRect(0, 0, canvas.width, canvas.height);

          // Enable better text rendering
          context.textRenderingOptimization = 'optimizeQuality';
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';

          // Rendre la page sur le canvas
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };

          await page.render(renderContext).promise;

          // Convertir le canvas en buffer PNG
          const imageBuffer = canvas.toBuffer('image/png');
          
          // Utiliser Sharp pour optimiser l'image pour OCR (keep color, better for complex layouts)
          try {
            const optimizedBuffer = await sharp(imageBuffer)
              // Keep color - sometimes helps OCR with colored text/backgrounds
              .ensureAlpha() // Ensure alpha channel
              .normalize() // Enhance contrast
              .sharpen(1.5, 1, 2) // Stronger sharpening for text (sigma, flat, jagged)
              .png({ 
                quality: 100, 
                compressionLevel: 0, // No compression for maximum quality
                adaptiveFiltering: true 
              })
              .toBuffer();
            
            images.push(optimizedBuffer);
            this.logger.log(`Page ${pageNum} converted and optimized: ${optimizedBuffer.length} bytes`);
          } catch (sharpError) {
            // Si Sharp échoue, utiliser le buffer direct
            this.logger.warn(`Sharp optimization failed for page ${pageNum}, using raw buffer`);
            images.push(imageBuffer);
          }
        } catch (error: any) {
          this.logger.error(`Failed to convert page ${pageNum}: ${error.message}`, error.stack);
          // Continue avec les autres pages même si une échoue
        }
      }

      if (images.length === 0) {
        throw new BadRequestException('Failed to extract any images from PDF. No pages could be converted.');
      }

      this.logger.log(`Successfully converted ${images.length}/${numPages} pages to images`);
      return images;
    } catch (error: any) {
      this.logger.error(`Error converting PDF to images: ${error.message}`, error.stack);
      
      if (error.message.includes('Cannot find module') || error.code === 'MODULE_NOT_FOUND') {
        throw new BadRequestException(
          'PDF processing libraries are required. Please install: npm install pdfjs-dist@^3.11.174 canvas pdf-lib sharp'
        );
      }
      
      throw new BadRequestException(
        `Failed to convert PDF to images: ${error.message}`
      );
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
      
      // Configurer Tesseract pour meilleure reconnaissance
      // PSM 6 = Assume a single uniform block of text (good for schedules)
      // PSM 11 = Sparse text (if schedule has gaps)
      // PSM 12 = Sparse text with OSD (Orientation and Script Detection)
      await worker.setParameters({
        tessedit_pageseg_mode: '6' as any, // Try uniform block first
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ :/-()[].,;!?',
        preserve_interword_spaces: '1',
      });
      
      // Effectuer l'OCR sur le fichier temporaire avec meilleure configuration
      const { data: { text } } = await worker.recognize(tempImagePath, {
        rectangle: undefined, // Process entire image
      });
      
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
   */
  private parseESPRITSchedule(text: string): Course[] {
    const courses: Course[] = [];
    // Nettoyer le texte OCR d'abord
    const cleanedText = this.cleanOCRText(text);
    const lines = cleanedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let currentDay: string | null = null;
    const processedLines = new Set<number>(); // Pour éviter les doublons
    
    for (let i = 0; i < lines.length; i++) {
      if (processedLines.has(i)) continue;
      
      const line = lines[i];
      
      // Détecter les jours (Lundi, Mardi, etc.)
      const dayMatch = this.detectDay(line);
      if (dayMatch) {
        currentDay = dayMatch;
        this.logger.debug(`📅 Day found: ${currentDay} from line: "${line}"`);
        
        // NOUVEAU: Chercher un cours DANS LA MÊME LIGNE après le jour
        // Ex: "Lundi En Ligne" ou "Mardi A13/ Electronique!"
        // Trouver la position du jour dans la ligne originale (peu importe la casse)
        const lowerLine = line.toLowerCase();
        let dayPosition = -1;
        let dayLength = 0;
        
        // Chercher le jour français
        for (const [frenchDay, englishDay] of Object.entries(this.dayMapping)) {
          if (englishDay === currentDay) {
            const pos = lowerLine.indexOf(frenchDay);
            if (pos !== -1) {
              dayPosition = pos;
              dayLength = frenchDay.length;
              break;
            }
          }
        }
        
        // Si pas trouvé en français, chercher en anglais
        if (dayPosition === -1) {
          const pos = lowerLine.indexOf(currentDay.toLowerCase());
          if (pos !== -1) {
            dayPosition = pos;
            dayLength = currentDay.length;
          }
        }
        
        if (dayPosition !== -1) {
          const lineAfterDay = line.substring(dayPosition + dayLength).trim();
          this.logger.debug(`📝 Text after day: "${lineAfterDay}"`);
          
          if (lineAfterDay.length > 0) {
            // Chercher cours avec horaire dans la même ligne
            const sameLineMatch = lineAfterDay.match(/(.+?)\s+(\d{1,2})H:(\d{2})\s*-\s*(\d{1,2})H:(\d{2})/);
            if (sameLineMatch) {
              let subject = sameLineMatch[1].trim()
                .replace(/\/$/, '')
                .replace(/^[;\s.]+/, '')
                .replace(/[;\s.]+$/, '')
                .trim();
              
              if (subject.length >= 5) {
                const startHour = sameLineMatch[2].padStart(2, '0');
                const startMin = sameLineMatch[3];
                const endHour = sameLineMatch[4].padStart(2, '0');
                const endMin = sameLineMatch[5];
                
                // Chercher salle
                const classroomMatch = lineAfterDay.match(/\b([A-Z]\d{2,3}|En Ligne)\b/i);
                
                courses.push({
                  day: currentDay,
                  start: `${startHour}:${startMin}`,
                  end: `${endHour}:${endMin}`,
                  subject: this.cleanOCRText(subject),
                  classroom: classroomMatch ? classroomMatch[1] : undefined,
                });
                this.logger.debug(`✅ Found course inline with day: ${subject} on ${currentDay}`);
                processedLines.add(i);
              }
            }
            // Chercher cours sans horaire dans la même ligne
            else if (lineAfterDay.length > 3 && !lineAfterDay.match(/^\d{2}\/\d{2}\/\d{4}/)) {
              let subject = lineAfterDay
                .replace(/\/$/, '')
                .replace(/^[;\s.]+/, '')
                .replace(/[;\s.]+$/, '')
                .trim();
              
              // Chercher salle
              const classroomMatch = subject.match(/\b([A-Z]\d{2,3}|En Ligne)\b/i);
              if (classroomMatch) {
                // Enlever la salle du nom du cours
                subject = subject.replace(classroomMatch[0], '').trim();
              }
              
              if (subject.length >= 3 && !subject.match(/^[\d\s\/:-]+$/)) {
                courses.push({
                  day: currentDay,
                  start: '09:00', // Heure par défaut
                  end: '10:30',
                  subject: this.cleanOCRText(subject),
                  classroom: classroomMatch ? classroomMatch[1] : undefined,
                });
                this.logger.debug(`✅ Found course inline with day (no time): ${subject} on ${currentDay}`);
                processedLines.add(i);
              }
            }
          }
        }
        
        // IMPORTANT: Chercher les cours dans les lignes PRÉCÉDENTES (2-3 lignes avant)
        // car dans le format ESPRIT, les cours apparaissent AVANT le nom du jour
        for (let j = Math.max(0, i - 3); j < i; j++) {
          if (processedLines.has(j)) continue;
          
          const prevLine = lines[j];
          
          // Ignorer les dates et les lignes déjà traitées
          if (prevLine.match(/^\d{2}\/\d{2}\/\d{4}/) || this.detectDay(prevLine)) {
            continue;
          }
          
          // Chercher cours avec horaire explicite
          const courseWithTimeMatch = prevLine.match(/(.+?)\s+(\d{1,2})H:(\d{2})\s*-\s*(\d{1,2})H:(\d{2})/);
          if (courseWithTimeMatch) {
            let subject = courseWithTimeMatch[1].trim()
              .replace(/\/$/, '')
              .replace(/^[;\s.]+/, '')
              .replace(/[;\s.]+$/, '')
              .trim();
            
            // Si le nom est trop court ou fragmenté, essayer de le reconstruire
            if (subject.length < 5 || subject.match(/^[A-Z]{1,2}$/)) {
              const reconstructed = this.reconstructCourseName(lines, j);
              if (reconstructed) {
                subject = reconstructed;
              } else {
                continue; // Ignorer si on ne peut pas reconstruire
              }
            }
            
            const startHour = courseWithTimeMatch[2].padStart(2, '0');
            const startMin = courseWithTimeMatch[3];
            const endHour = courseWithTimeMatch[4].padStart(2, '0');
            const endMin = courseWithTimeMatch[5];
            
            // Chercher la salle dans les lignes autour
            let classroom: string | undefined;
            for (let k = Math.max(0, j - 2); k < Math.min(j + 3, lines.length); k++) {
              const nearLine = lines[k];
              const classroomMatch = nearLine.match(/\b([A-Z]\d{2,3}|En Ligne)\b/i);
              if (classroomMatch) {
                classroom = classroomMatch[1];
                break;
              }
            }
            
            if (subject.length > 5) {
              courses.push({
                day: currentDay,
                start: `${startHour}:${startMin}`,
                end: `${endHour}:${endMin}`,
                subject: subject,
                classroom: classroom,
              });
              this.logger.debug(`Found course (before day): ${subject} on ${currentDay} at ${startHour}:${startMin}`);
              processedLines.add(j);
            }
          }
          
          // Chercher cours sans horaire (plus flexible)
          // Pattern amélioré pour capturer les noms de cours même fragmentés
          if (!prevLine.match(/\d{1,2}H:\d{2}/) && 
              !prevLine.match(/^\d{2}\/\d{2}\/\d{4}/) &&
              !this.detectDay(prevLine) &&
              prevLine.length > 3) {
            
            // Essayer plusieurs patterns
            let subject: string | null = null;
            
            // Pattern 1: Nom de cours classique avec "/"
            const courseMatch1 = prevLine.match(/([A-Za-z][A-Za-z0-9\s,\(\)\/\-_&]+?)(?:\s*\/\s*$|\s*$)/);
            if (courseMatch1) {
              subject = courseMatch1[1].trim()
                .replace(/\/$/, '')
                .replace(/^[;\s.]+/, '')
                .replace(/[;\s.]+$/, '')
                .trim();
            }
            
            // Pattern 2: Si pas trouvé, prendre toute la ligne si elle ressemble à un cours
            if (!subject || subject.length < 5) {
              const courseMatch2 = prevLine.match(/([A-Za-z][A-Za-z0-9\s,\(\)\-_&]{4,})/);
              if (courseMatch2) {
                subject = courseMatch2[1].trim();
              }
            }
            
            // Si le nom est fragmenté, essayer de le reconstruire
            if (subject && (subject.length < 5 || subject.match(/^[A-Z]{1,2}$/))) {
              const reconstructed = this.reconstructCourseName(lines, j);
              if (reconstructed) {
                subject = reconstructed;
              } else {
                subject = null; // Ignorer si trop court
              }
            }
            
            // Filtrer les lignes invalides
            if (subject && 
                subject.length >= 5 && 
                !subject.match(/^[A-Z]{1,2}$/) && 
                !subject.match(/^[\s;,]+$/) &&
                !subject.match(/^[PÀaUSEFes]+$/) &&
                !subject.match(/^[A-Z]\d{2,3}$/)) {
              
              // Nettoyer le nom
              subject = this.cleanOCRText(subject);
              
              // Chercher la salle
              let classroom: string | undefined;
              for (let k = Math.max(0, j - 2); k < Math.min(j + 3, lines.length); k++) {
                const nearLine = lines[k];
                if (this.detectDay(nearLine) || nearLine.match(/^\d{2}\/\d{2}\/\d{4}/)) {
                  break;
                }
                const classroomMatch = nearLine.match(/\b([A-Z]\d{2,3}|En Ligne)\b/i);
                if (classroomMatch) {
                  classroom = classroomMatch[1];
                  break;
                }
              }
              
              // Déterminer l'horaire par défaut basé sur la position
              // Si c'est dans la première moitié, matin, sinon après-midi
              let defaultTime = { start: '10:45', end: '12:15' }; // Par défaut matin
              if (j > lines.length / 2) {
                defaultTime = { start: '15:15', end: '16:45' }; // Après-midi
              }
              
              courses.push({
                day: currentDay,
                start: defaultTime.start,
                end: defaultTime.end,
                subject: subject,
                classroom: classroom,
              });
              this.logger.debug(`Found course (no time, before day): ${subject} on ${currentDay}`);
              processedLines.add(j);
            }
          }
        }
        
        continue;
      }
      
      if (!currentDay) continue;
      
      // Format avec horaire explicite : "Nom du cours/ 13H:30 - 16H:45" ou "Nom du cours 13H:30 - 16H:45"
      // Plus flexible : peut avoir des caractères avant (comme ";")
      const courseWithTimeMatch = line.match(/(.+?)\s+(\d{1,2})H:(\d{2})\s*-\s*(\d{1,2})H:(\d{2})/);
      if (courseWithTimeMatch) {
        let subject = courseWithTimeMatch[1].trim()
          .replace(/\/$/, '')
          .replace(/^[;\s]+/, '') // Enlever les ";" et espaces au début
          .replace(/[;\s]+$/, '') // Enlever les ";" et espaces à la fin
          .trim();
        
        const startHour = courseWithTimeMatch[2].padStart(2, '0');
        const startMin = courseWithTimeMatch[3];
        const endHour = courseWithTimeMatch[4].padStart(2, '0');
        const endMin = courseWithTimeMatch[5];
        
        // Chercher la salle dans les lignes suivantes (dans les 3 prochaines lignes)
        let classroom: string | undefined;
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const nextLine = lines[j];
          // Chercher salle (A12, G102, etc.) ou "En Ligne"
          const classroomMatch = nextLine.match(/\b([A-Z]\d{2,3}|En Ligne)\b/i);
          if (classroomMatch) {
            classroom = classroomMatch[1];
            break;
          }
        }
        
        // Chercher aussi la salle dans la ligne actuelle (après le cours)
        if (!classroom) {
          const inlineClassroom = line.match(/\b([A-Z]\d{2,3}|En Ligne)\b/i);
          if (inlineClassroom) {
            classroom = inlineClassroom[1];
          }
        }
        
        // Si fragmenté, reconstruire
        if (subject.length < 5 || subject.match(/^[A-Z]{1,2}$/)) {
          const reconstructed = this.reconstructCourseName(lines, i);
          if (reconstructed) {
            subject = reconstructed;
          } else {
            continue;
          }
        }
        
        subject = this.cleanOCRText(subject);
        
        if (subject.length > 5) {
          courses.push({
            day: currentDay,
            start: `${startHour}:${startMin}`,
            end: `${endHour}:${endMin}`,
            subject: subject,
            classroom: classroom,
          });
          this.logger.debug(`Found course: ${subject} on ${currentDay} at ${startHour}:${startMin}`);
          processedLines.add(i);
        }
        continue;
      }
      
      // Format sans horaire (cours dans une colonne du tableau)
      // Ex: "Procedural Programming 1/" ou "Algorithmic 1/" ou "Fundamentals of Math 1/"
      // Plus flexible : peut avoir des caractères avant ou après
      const courseMatch = line.match(/([A-Za-z][A-Za-z0-9\s,\(\)\/\-]+?)(?:\s*\/\s*$|\s*$)/);
      if (courseMatch && !line.match(/\d{1,2}H:\d{2}/) && !line.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        let subject = courseMatch[1].trim()
          .replace(/\/$/, '')
          .replace(/^[;\s]+/, '')
          .replace(/[;\s]+$/, '')
          .trim();
        
        // Si fragmenté, reconstruire
        if (subject.length < 5 || subject.match(/^[A-Z]{1,2}$/)) {
          const reconstructed = this.reconstructCourseName(lines, i);
          if (reconstructed) {
            subject = reconstructed;
          } else {
            continue;
          }
        }
        
        // Ignorer les lignes invalides
        if (subject.match(/^[\s;,]+$/) ||
            subject.match(/^[PÀaUSEFes]+$/) ||
            this.detectDay(subject)) {
          continue;
        }
        
        subject = this.cleanOCRText(subject);
        
        // Déterminer l'horaire basé sur la position
        let defaultTime = { start: '10:45', end: '12:15' };
        if (i > lines.length / 2) {
          defaultTime = { start: '15:15', end: '16:45' };
        }
        
        // Chercher la salle dans les lignes suivantes
        let classroom: string | undefined;
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const nextLine = lines[j];
          // Ignorer si c'est un jour ou une date
          if (this.detectDay(nextLine) || nextLine.match(/^\d{2}\/\d{2}\/\d{4}/)) {
            break;
          }
          const classroomMatch = nextLine.match(/\b([A-Z]\d{2,3}|En Ligne)\b/i);
          if (classroomMatch) {
            classroom = classroomMatch[1];
            break;
          }
        }
        
        // Chercher aussi dans la ligne actuelle
        if (!classroom) {
          const inlineClassroom = line.match(/\b([A-Z]\d{2,3}|En Ligne)\b/i);
          if (inlineClassroom) {
            classroom = inlineClassroom[1];
          }
        }
        
        courses.push({
          day: currentDay,
          start: defaultTime.start,
          end: defaultTime.end,
          subject: subject,
          classroom: classroom,
        });
        this.logger.debug(`Found course (no time): ${subject} on ${currentDay}`);
        processedLines.add(i);
      }
    }
    
    this.logger.log(`ESPRIT parser found ${courses.length} courses`);
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
