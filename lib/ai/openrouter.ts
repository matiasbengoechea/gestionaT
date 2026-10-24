import type { ClientProfile } from "../clients";
import { extractWithOpenAICompatible } from "./openai";

/**
 * OpenRouter expone el mismo contrato que OpenAI Chat Completions, así que
 * reutilizamos el cliente cambiando la base y agregando los headers de ruteo.
 */
export async function extractWithOpenRouter(
  input: { base64: string; mimeType: string; fileName: string; text?: string },
  client: ClientProfile,
  model: string,
  apiKey: string,
): Promise<unknown> {
  return extractWithOpenAICompatible(input, client, model, apiKey, {
    baseUrl: "https://openrouter.ai/api/v1",
    providerLabel: "OpenRouter",
    extraHeaders: {
      "HTTP-Referer": "https://gestionat.vercel.app",
      "X-Title": "GestionaT",
    },
  });
}
