import { invoiceJsonSchema, toGeminiSchema } from "./schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { ClientProfile } from "../clients";

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  error?: { message?: string };
}

export async function extractWithGemini(
  input: { base64: string; mimeType: string },
  client: ClientProfile,
  model: string,
  apiKey: string,
): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;

  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
    responseMimeType: "application/json",
    responseSchema: toGeminiSchema(invoiceJsonSchema),
    maxOutputTokens: 8192,
  };

  // Los modelos 2.5 razonan por defecto; para una demo necesitamos latencia baja.
  if (model.startsWith("gemini-2.5")) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: input.mimeType, data: input.base64 } },
            { text: buildUserPrompt(client) },
          ],
        },
      ],
      generationConfig,
    }),
  });

  const payload = (await response.json().catch(() => null)) as GeminiResponse | null;

  if (!response.ok) {
    const detail = payload?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`Gemini rechazó la solicitud: ${detail}`);
  }

  const text = (payload?.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini devolvió una respuesta vacía.");
  }

  return text;
}
