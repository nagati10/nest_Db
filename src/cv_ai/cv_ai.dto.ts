import { IsOptional, IsNumber, Min, Max } from 'class-validator';

export class AnalyzeDocumentDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(9)
  maxPages?: number = 2;
}

export class DocumentAnalysisResponse {
  images: any[];
  contiguousText: string;
  layoutSections: string;
  tablesHtml: string;
  success: boolean;
}

export class CvDataResponse {
  rawText: string;
  layout: string;
  tables: string;
  structured: {
    name: string | null;
    email: string | null;
    phone: string | null;
    experience: string[];
    education: string[];
    skills: string[];
  };
}