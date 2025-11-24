import { Injectable } from "@nestjs/common";
import fetch from "node-fetch";

@Injectable()
export class CvAiService {
  // ✅ Free vision model (supports images)
  private readonly MODEL_ID = "qwen/qwen2.5-vl-32b-instruct:free";

  private readonly OPENROUTER_URL =
    "https://openrouter.ai/api/v1/chat/completions";

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
      '  "education": [',
      "    {",
      '      "degree": null,',
      '      "school": null,',
      '      "startDate": null,',
      '      "endDate": null',
      "    }",
      "  ]",
      "}",
      "",
      "CV CONTENT (OCR TEXT):",
      cvText,
    ].join("\n");
  }

  // ✅ analyze image (base64) مباشرة
  async analyzeImage(base64Image: string) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");

    const prompt = "Extract the CV text then output the JSON profile.";

    const res = await fetch(this.OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // optional but recommended by OpenRouter
        "HTTP-Referer": "https://talleb-5edma.onrender.com",
        "X-Title": "Taleb 5edma CV AI",
      },
      body: JSON.stringify({
        model: this.MODEL_ID,
        messages: [
          {
            role: "user",
            // ✅ OpenRouter multimodal format: text then image_url
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error("OpenRouter Error: " + err);
    }

    const data: any = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";

    try {
      return JSON.parse(raw);
    } catch {
      return { error: "Invalid JSON from model", raw };
    }
  }

  // ✅ analyze OCR text (if you already extracted text)
  async analyzeText(cvText: string) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is missing");

    const prompt = this.buildPrompt(cvText);

    const res = await fetch(this.OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://talleb-5edma.onrender.com",
        "X-Title": "Taleb 5edma CV AI",
      },
      body: JSON.stringify({
        model: this.MODEL_ID,
        messages: [
          { role: "system", content: "You output JSON only." },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error("OpenRouter Error: " + err);
    }

    const data: any = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";

    try {
      return JSON.parse(raw);
    } catch {
      return { error: "Invalid JSON from model", raw };
    }
  }
}