import type { ClientProfile } from "../clients";
import type { InvoiceData } from "../types";
import { extractWithGemini } from "./gemini";
import { extractWithOpenAI } from "./openai";
import { extractWithOpenRouter } from "./openrouter";
import { normalizeInvoice } from "./normalize";

export type ProviderName = "gemini" | "openai" | "openrouter";

export interface ProviderConfig {
  provider: ProviderName;
  model: string;
  apiKey: string;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "No hay una API key de IA configurada. Definí OPENROUTER_API_KEY, GEMINI_API_KEY u OPENAI_API_KEY en las variables de entorno.",
    );
    this.name = "MissingApiKeyError";
  }
}

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

/** Resuelve el proveedor según `AI_PROVIDER` o, si no está, según la key presente. */
export function resolveProvider(): ProviderConfig {
  const requested = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const geminiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "").trim();
  const openaiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  const openrouterKey = (process.env.OPENROUTER_API_KEY ?? "").trim();

  if (requested === "gemini" || (!requested && geminiKey)) {
    if (!geminiKey) throw new MissingApiKeyError();
    return {
      provider: "gemini",
      model: (process.env.GEMINI_MODEL ?? "gemini-2.5-flash").trim(),
      apiKey: geminiKey,
    };
  }

  if (requested === "openai" || (!requested && openaiKey)) {
    if (!openaiKey) throw new MissingApiKeyError();
    return {
      provider: "openai",
      model: (process.env.OPENAI_MODEL ?? "gpt-4.1-mini").trim(),
      apiKey: openaiKey,
    };
  }

  if (requested === "openrouter" || (!requested && openrouterKey)) {
    if (!openrouterKey) throw new MissingApiKeyError();
    return {
      provider: "openrouter",
      model: (process.env.OPENROUTER_MODEL ?? "openai/gpt-6-luna").trim(),
      apiKey: openrouterKey,
    };
  }

  throw new MissingApiKeyError();
}

function parseJson(text: unknown): unknown {
  if (typeof text !== "string") return text;
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new ExtractionError("El modelo no devolvió un JSON válido.");
  }
}

export interface ExtractInput {
  base64: string;
  mimeType: string;
  fileName: string;
  /**
   * Texto ya extraído (por ejemplo, de un HTML o del cuerpo de un mail).
   * Si viene, el modelo lee esto en lugar del binario.
   */
  text?: string;
}

export interface ExtractResult {
  invoice: InvoiceData;
  provider: ProviderName;
  model: string;
}

export async function extractInvoice(
  input: ExtractInput,
  client: ClientProfile,
): Promise<ExtractResult> {
  const config = resolveProvider();

  let raw: unknown;
  if (config.provider === "gemini") {
    raw = await extractWithGemini(input, client, config.model, config.apiKey);
  } else if (config.provider === "openrouter") {
    raw = await extractWithOpenRouter(input, client, config.model, config.apiKey);
  } else {
    raw = await extractWithOpenAI(input, client, config.model, config.apiKey);
  }

  const invoice = normalizeInvoice(parseJson(raw));

  return { invoice, provider: config.provider, model: config.model };
}
