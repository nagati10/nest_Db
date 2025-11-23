import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class CvAiService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private buildPrompt(cvText: string) {
    return `
You are an expert CV/Resume parser.

Extract structured data from the CV text below.
Return ONLY valid JSON matching this schema:

{
  "fullName": null,
  "email": null,
  "phone": null,
  "location": null,
  "headline": null,
  "summary": null,
  "skills": [],
  "experiences": [
    {"title": null, "company": null, "startDate": null, "endDate": null, "description": null}
  ],
  "education": [
    {"degree": null, "school": null, "startDate": null, "endDate": null}
  ]
}

Rules:
- If info missing: keep null or empty array.
- Don't add extra keys.
- Experiences ordered newest -> oldest.
- Skills are short strings.

CV TEXT:
${cvText}
`;
  }

  async analyze(cvText: string) {
    const prompt = this.buildPrompt(cvText);

    const resp = await this.openai.responses.create({
      model: 'gpt-5-mini', // تنجم تبدلها gpt-4.1-mini إذا تحب أرخص
      input: [
        { role: 'system', content: 'You output JSON only.' },
        { role: 'user', content: prompt },
      ],

      // ✅ FIX: Responses API الجديد
      text: {
        format: { type: 'json_object' },
      },
    });

    // resp.output_text فيه JSON string
    return JSON.parse(resp.output_text);
  }
}