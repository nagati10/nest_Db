import { Injectable } from "@nestjs/common";
import fetch from "node-fetch";

@Injectable()
export class CvAiService {

  private readonly API_URL = "https://openrouter.ai/api/v1/chat/completions";
  private readonly MODEL_ID = "google/gemini-3-pro-image-preview";

  async analyzeImage(base64: string) {

    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("Missing OPENROUTER_API_KEY in environment variables");
    }

    // 👇 محتوى الرسالة المبعوث للموديل
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Extract all text from this CV image and return ONLY the raw extracted text."
          },
          {
            type: "input_image",
            image_url: `data:image/jpeg;base64,${base64}`
          }
        ]
      }
    ];

    // 👇 إرسال الطلب
    const response = await fetch(this.API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.MODEL_ID,
        messages,
        extra_body: {
          modalities: ["image", "text"]
        },
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error("OpenRouter Error: " + err);
    }

    // ⬇️ data any لتفادي مشكلة choices undefined
    const data: any = await response.json();

    const raw = data?.choices?.[0]?.message?.content ?? "";

    if (!raw) {
      return { error: "MODEL_RETURNED_EMPTY", data };
    }

    return {
      text: raw
    };
  }
}