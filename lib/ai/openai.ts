import { invoiceJsonSchema } from "./schema";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import type { ClientProfile } from "../clients";

interface ChatResponse {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> | null } }>;
  error?: { message?: string };
}

export interface CompatibleOptions {
  /** Base de la API, sin `/chat/completions`. */
  baseUrl?: string;
  extraHeaders?: Record<string, string>;
  providerLabel?: string;
}

function contentToText(
  content: string | Array<{ text?: string }> | null | undefined,
): string {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? "")
      .join("")
      .trim();
  }
  return "";
}

/**
 * Cliente para cualquier API compatible con OpenAI Chat Completions
 * (OpenAI y OpenRouter comparten el mismo contrato).
 */
export async function extractWithOpenAICompatible(
  input: { base64: string; mimeType: string; fileName: string; text?: string },
  client: ClientProfile,
  model: string,
  apiKey: string,
  options: CompatibleOptions = {},
): Promise<unknown> {
  const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
  const label = options.providerLabel ?? "OpenAI";
  const dataUrl = `data:${input.mimeType};base64,${input.base64}`;

  const filePart = input.text
    ? {
        type: "text",
        text: `Contenido del comprobante (texto extraído de un HTML):\n\n${input.text}`,
      }
    : input.mimeType === "application/pdf"
      ? {
          type: "file",
          file: { filename: input.fileName, file_data: dataUrl },
        }
      : {
          type: "image_url",
          image_url: { url: dataUrl },
        };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...options.extraHeaders,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [{ type: "text", text: buildUserPrompt(client) }, filePart],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "factura",
          strict: true,
          schema: invoiceJsonSchema,
        },
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as ChatResponse | null;

  if (!response.ok) {
    const detail = payload?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`${label} rechazó la solicitud: ${detail}`);
  }

  const text = contentToText(payload?.choices?.[0]?.message?.content);
  if (!text) {
    throw new Error(`${label} devolvió una respuesta vacía.`);
  }

  return text;
}

export async function extractWithOpenAI(
  input: { base64: string; mimeType: string; fileName: string; text?: string },
  client: ClientProfile,
  model: string,
  apiKey: string,
): Promise<unknown> {
  return extractWithOpenAICompatible(input, client, model, apiKey, {
    providerLabel: "OpenAI",
  });
}
