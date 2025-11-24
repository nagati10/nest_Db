import { Injectable } from "@nestjs/common";
import fetch from "node-fetch";

@Injectable()
export class CvAiService {
  private readonly MODEL_ID = "mistralai/Mistral-7B-Instruct-v0.3";

  // HF Router (OpenAI compatible)
  private readonly HF_URL = "https://router.huggingface.co/v1/chat/completions";

  private buildPrompt(cvText: string): string {
    return [
      "You are an expert CV parser.",
      "Return ONLY valid JSON with this schema:",
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
        "Authorization": "Bearer " + (process.env.HF_TOKEN ?? ""),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.MODEL_ID,
        messages: [
          { role: "system", content: "You output JSON only." },
          { role: "user", content: prompt }
        ],
        max_tokens: 900,
        temperature: 0.2
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error("HF Error: " + errText);
    }

    const data: any = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";

    try {
      return JSON.parse(raw);
    } catch {
      return { error: "Invalid JSON", raw };
    }
  }
}