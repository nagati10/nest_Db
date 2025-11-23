import { Injectable } from "@nestjs/common";
import fetch from "node-fetch";

@Injectable()
export class CvAiService {
  private readonly HF_URL =
    "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3";

  private buildPrompt(cvText: string): string {
    return [
      "Extract CV information and return ONLY valid JSON:",
      "",
      "{",
      '  "fullName": null,',
      '  "email": null,',
      '  "phone": null,',
      '  "location": null,',
      '  "headline": null,',
      '  "summary": null,',
      '  "skills": [],',
      '  "experiences": [',
      "    {",
      '      "title": null,',
      '      "company": null,',
      '      "startDate": null,',
      '      "endDate": null,',
      '      "description": null',
      "    }",
      "  ],",
      '  "education": []',
      "}",
      "",
      "CV CONTENT:",
      cvText
    ].join("\n");
  }

  async analyze(cvText: string) {
    const prompt = this.buildPrompt(cvText);

    const res = await fetch(this.HF_URL, {
      method: "POST",
      headers: {
        // ✅ بلا backticks
        Authorization: "Bearer " + (process.env.HF_TOKEN ?? ""),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 800
        }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error("HF Error: " + err);
    }

    const data: any = await res.json();

    const raw =
      Array.isArray(data) ? data[0]?.generated_text : data.generated_text;

    try {
      return JSON.parse(raw);
    } catch {
      return { error: "Invalid JSON", raw };
    }
  }
}