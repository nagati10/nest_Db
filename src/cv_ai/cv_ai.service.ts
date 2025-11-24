import { Injectable } from "@nestjs/common";
import fetch from "node-fetch";

@Injectable()
export class CvAiService {
  private readonly OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
  private readonly MODEL_ID = "google/gemini-2.0-flash-lite-preview";

  private buildPrompt(): string {
    return `
You are an expert CV parser.
Extract ALL information from this CV image.
Return ONLY valid JSON with this schema (no extra text, no markdown):

{
  "fullName": null,
  "email": null,
  "phone": null,
  "location": null,
  "headline": null,
  "summary": null,
  "skills": [],
  "experiences": [
    {
      "title": null,
      "company": null,
      "startDate": null,
      "endDate": null,
      "description": null
    }
  ],
  "education": [
    {
      "degree": null,
      "school": null,
      "startDate": null,
      "endDate": null
    }
  ]
}

Rules:
- If info missing → keep null/empty.
- Experiences newest → oldest.
- Output JSON only.
`.trim();
  }

  async analyzeImage(base64: string) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("Missing OPENROUTER_API_KEY");
    }

    const prompt = this.buildPrompt();

    const res = await fetch(this.OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        // optional but recommended by OpenRouter
        "HTTP-Referer": "https://talleb-5edma.onrender.com",
        "X-Title": "Taleb5edma CV AI",
      },
      body: JSON.stringify({
        model: this.MODEL_ID,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64}` }
              },
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ],
        max_tokens: 1200,
        temperature: 0.2
      }),
    });

    const data: any = await res.json();

    if (!res.ok) {
      // OpenRouter errors يجيوا هنا
      const errText = JSON.stringify(data);
      throw new Error("OpenRouter Error: " + errText);
    }

    // ✅ safe read (ما عادش TS error)
    const raw =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "{}";

    try {
      return JSON.parse(raw);
    } catch {
      return { error: "Invalid JSON from model", raw };
    }
  }
}