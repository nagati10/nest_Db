import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Tesseract from 'tesseract.js';

@Injectable()
export class CvAiService {
  constructor(private configService: ConfigService) {}

  async analyzeDocument(file: Express.Multer.File, maxPages: number = 2) {
    try {
      console.log('📄 Analyse document avec OCR:', {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });

      const isPdf = file.mimetype === 'application/pdf';
      let extractedText = '';

      if (isPdf) {
        extractedText = await this.extractTextFromPdfServer(file.buffer, maxPages);
      } else {
        extractedText = await this.extractTextFromImage(file.buffer);
      }

      console.log('✅ Texte extrait:', extractedText.substring(0, 100));

      const layoutSections = this.analyzeLayout(extractedText);
      const tablesHtml = this.extractTables(extractedText);

      return {
        images: [],
        contiguousText: extractedText,
        layoutSections,
        tablesHtml,
        success: true,
      };
    } catch (error) {
      console.error('❌ Erreur OCR:', error.message);
      throw new HttpException(
        `Erreur lors de l'analyse du document: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async extractTextFromImage(buffer: Buffer): Promise<string> {
    try {
      console.log("🔍 OCR de l'image en cours...");
      const result = await Tesseract.recognize(buffer, 'eng+fra', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`Progression OCR: ${Math.round(m.progress * 100)}%`);
          }
        },
      });
      console.log('✅ OCR terminé');
      return result.data.text;
    } catch (error) {
      throw new Error(`Erreur OCR image: ${error.message}`);
    }
  }

  private async extractTextFromPdfServer(
    buffer: Buffer,
    maxPages: number,
  ): Promise<string> {
    try {
      console.log('📖 Extraction texte PDF...');
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer, { max: maxPages });
      console.log('✅ PDF extrait:', data.numpages, 'pages');
      return data.text;
    } catch (error) {
      console.error('❌ Erreur PDF:', error);
      console.log('⚠️ Tentative OCR sur PDF...');
      try {
        return await this.extractTextFromImage(buffer);
      } catch (ocrError) {
        throw new Error(`Impossible d'extraire le texte du PDF: ${error.message}`);
      }
    }
  }

  private analyzeLayout(text: string): string {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l);
    const sections: string[] = [];

    let currentSection = '';
    for (const line of lines) {
      const isTitle =
        (line.length < 50 && line === line.toUpperCase() && line.length > 3) ||
        line.endsWith(':') ||
        /^(##|SECTION|PARTIE)/i.test(line);

      if (isTitle) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = `\n## ${line}\n`;
      } else {
        currentSection += line + '\n';
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections.join('\n');
  }

  private extractTables(text: string): string {
    const lines = text.split('\n');
    const tableLines = lines.filter((line) => {
      const tabCount = (line.match(/\t/g) || []).length;
      const pipeCount = (line.match(/\|/g) || []).length;
      return tabCount >= 2 || pipeCount >= 2;
    });

    if (tableLines.length === 0) return '';

    let html = '<table border="1" style="border-collapse: collapse;"><tbody>';
    tableLines.forEach((line) => {
      const cells = line.split(/[\t|]/).filter((cell) => cell.trim());
      if (cells.length > 0) {
        html += '<tr>';
        cells.forEach((cell) => {
          html += `<td style="padding: 5px; border: 1px solid #ddd;">${this.escapeHtml(
            cell.trim(),
          )}</td>`;
        });
        html += '</tr>';
      }
    });
    html += '</tbody></table>';

    return html;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // ---------- NOUVELLE VERSION: ne renvoie que les champs structurés ----------

  async extractCvData(file: Express.Multer.File) {
    const result = await this.analyzeDocument(file, 2);

    // 👉 retourne directement { name, email, phone, experience, education, skills }
    return this.parseStructuredData(result);
  }

  private parseStructuredData(result: any) {
    const text = result.contiguousText;
    const layout = result.layoutSections;

    return {
      name: this.extractName(text),
      email: this.extractEmail(text),
      phone: this.extractPhone(text),
      experience: this.extractExperience(layout),
      education: this.extractEducation(layout),
      skills: this.extractSkills(text),
    };
  }

  private extractEmail(text: string): string | null {
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const matches = text.match(emailRegex);
    return matches ? matches[0] : null;
  }

  private extractPhone(text: string): string | null {
    const patterns = [
      /\+?\d{1,3}[-.\s]?\(?\d{2,3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      /\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}[-.\s]?\d{2}/g,
      /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return null;
  }

  private extractName(text: string): string | null {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    for (const line of lines.slice(0, 10)) {
      if (line.includes('@') || /\d{4,}/.test(line)) continue;
      if (line.length < 3 || line.length > 60) continue;
      if (/\d+\s+\w+\s+(street|avenue|road|rue|avenue)/i.test(line)) continue;

      const wordCount = line.split(/\s+/).length;
      if (wordCount >= 2 && wordCount <= 4) {
        return line;
      }
    }

    return lines[0] || null;
  }

  private extractExperience(layoutText: string): string[] {
    const keywords = [
      'expérience professionnelle',
      'professional experience',
      'work experience',
      'expérience',
      'experience',
      'carrière',
      'career',
      'emploi',
      'employment',
    ];
    return this.extractSection(layoutText, keywords, 10);
  }

  private extractEducation(layoutText: string): string[] {
    const keywords = [
      'formation',
      'education',
      'éducation',
      'diplôme',
      'degree',
      'études',
      'studies',
      'parcours académique',
      'academic',
    ];
    return this.extractSection(layoutText, keywords, 10);
  }

  private extractSection(
    text: string,
    keywords: string[],
    maxItems: number = 10,
  ): string[] {
    const lines = text.split('\n').map((l) => l.trim());
    const results: string[] = [];
    let inSection = false;
    let emptyLineCount = 0;

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      if (keywords.some((k) => lowerLine.includes(k.toLowerCase()))) {
        inSection = true;
        emptyLineCount = 0;
        continue;
      }

      if (inSection) {
        if (line.length === 0) {
          emptyLineCount++;
          if (emptyLineCount >= 2) break;
          continue;
        }

        emptyLineCount = 0;

        if (keywords.some((k) => lowerLine.includes(k.toLowerCase()))) {
          break;
        }

        if (line.length > 5 && line.length < 300) {
          results.push(line);
        }

        if (results.length >= maxItems) break;
      }
    }

    return results;
  }

  private extractSkills(text: string): string[] {
    const skillsKeywords = [
      'JavaScript',
      'TypeScript',
      'Python',
      'Java',
      'C++',
      'C#',
      'Ruby',
      'PHP',
      'Go',
      'Rust',
      'Kotlin',
      'Swift',
      'Scala',
      'Dart',
      'R',
      'React',
      'Angular',
      'Vue.js',
      'Svelte',
      'Next.js',
      'Nuxt.js',
      'HTML',
      'CSS',
      'Sass',
      'Less',
      'Tailwind',
      'Bootstrap',
      'Node.js',
      'Express',
      'NestJS',
      'Django',
      'Flask',
      'FastAPI',
      'Spring',
      'Laravel',
      'Symfony',
      'Rails',
      'ASP.NET',
      'React Native',
      'Flutter',
      'Xamarin',
      'Ionic',
      'Android',
      'iOS',
      'MongoDB',
      'PostgreSQL',
      'MySQL',
      'SQL',
      'Redis',
      'Elasticsearch',
      'Oracle',
      'SQLite',
      'Firebase',
      'DynamoDB',
      'Cassandra',
      'Docker',
      'Kubernetes',
      'AWS',
      'Azure',
      'GCP',
      'Terraform',
      'Jenkins',
      'GitLab CI',
      'GitHub Actions',
      'CircleCI',
      'Git',
      'Jira',
      'Confluence',
      'Figma',
      'Postman',
      'Agile',
      'Scrum',
      'Kanban',
      'TDD',
      'CI/CD',
      'Microservices',
      'REST API',
      'GraphQL',
      'WebSocket',
      'OAuth',
      'JWT',
    ];

    const foundSkills = new Set<string>();

    skillsKeywords.forEach((skill) => {
      const lowerSkill = skill.toLowerCase();
      const regex = new RegExp(`\\b${lowerSkill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text)) {
        foundSkills.add(skill);
      }
    });

    return Array.from(foundSkills).sort();
  }
}
