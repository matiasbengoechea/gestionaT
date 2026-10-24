import { NextResponse } from "next/server";
import { getClient } from "@/lib/clients";
import { extractInvoice, MissingApiKeyError } from "@/lib/ai";
import { applyFx } from "@/lib/fx";
import { validateInvoice } from "@/lib/validate";
import type { ErrorResponse, ExtractionResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Límite prudente: Vercel corta el body de las funciones en ~4.5 MB. */
const MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function fail(code: string, error: string, status: number) {
  return NextResponse.json<ErrorResponse>({ ok: false, code, error }, { status });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("invalid_body", "No se pudo leer el formulario enviado.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail("missing_file", "Falta el archivo de la factura.", 400);
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return fail(
      "unsupported_type",
      `Formato no soportado (${file.type || "desconocido"}). Subí un PDF, PNG, JPG o WEBP.`,
      415,
    );
  }

  if (file.size > MAX_BYTES) {
    return fail(
      "file_too_large",
      `El archivo supera los 4 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB). Comprimilo o subí una versión más liviana.`,
      413,
    );
  }

  const clientId = String(form.get("clientId") ?? "");
  const client = getClient(clientId);
  if (!client) {
    return fail("unknown_client", "El cliente seleccionado no existe.", 400);
  }

  let knownKeys: string[] = [];
  const knownRaw = form.get("known");
  if (typeof knownRaw === "string" && knownRaw.trim()) {
    try {
      const parsed = JSON.parse(knownRaw);
      if (Array.isArray(parsed)) {
        knownKeys = parsed.filter((entry): entry is string => typeof entry === "string");
      }
    } catch {
      // Si el cliente manda un `known` inválido, seguimos sin detección de duplicados.
    }
  }

  const startedAt = Date.now();

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { invoice, provider, model } = await extractInvoice(
      {
        base64: buffer.toString("base64"),
        mimeType: file.type,
        fileName: file.name,
      },
      client,
    );

    const enriched = await applyFx(invoice);
    const issues = validateInvoice(enriched, client, knownKeys);

    return NextResponse.json<ExtractionResponse>({
      ok: true,
      invoice: enriched,
      issues,
      meta: {
        provider,
        model,
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return fail("missing_api_key", error.message, 503);
    }

    const message =
      error instanceof Error ? error.message : "Error inesperado al procesar la factura.";

    console.error("[extract] fallo al procesar la factura:", error);
    return fail("extraction_failed", message, 502);
  }
}
