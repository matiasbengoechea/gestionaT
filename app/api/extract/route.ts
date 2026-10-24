import { NextResponse } from "next/server";
import { getClient } from "@/lib/clients";
import { extractInvoice, MissingApiKeyError } from "@/lib/ai";
import { documentKind, mimeForDocument } from "@/lib/file-kind";
import { applyFx } from "@/lib/fx";
import { htmlToText } from "@/lib/html";
import { validateInvoice } from "@/lib/validate";
import type { ErrorResponse, ExtractionResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Límite prudente: Vercel corta el body de las funciones en ~4.5 MB. */
const MAX_BYTES = 4 * 1024 * 1024;


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

  const kind = documentKind(file.name, file.type);
  if (!kind) {
    return fail(
      "unsupported_type",
      `Formato no soportado (${file.type || "desconocido"}). Subí un PDF, PNG, JPG, WEBP, HTML o TXT.`,
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
    const mimeType = mimeForDocument(kind, file.name, file.type);

    // HTML y texto se mandan como texto: el modelo no necesita el markup.
    let text: string | undefined;
    if (kind === "html") {
      text = htmlToText(buffer.toString("utf8"));
    } else if (kind === "text") {
      text = buffer.toString("utf8").trim();
    }

    if ((kind === "html" || kind === "text") && !text) {
      return fail(
        "empty_document",
        "El archivo no tiene texto legible. Si la factura está como imagen dentro del HTML, subila como PDF o imagen.",
        422,
      );
    }

    const { invoice, provider, model } = await extractInvoice(
      {
        base64: buffer.toString("base64"),
        mimeType,
        fileName: file.name,
        text,
      },
      client,
    );

    const fx = await applyFx(invoice);
    const enriched = fx.invoice;
    const issues = validateInvoice(enriched, client, knownKeys);
    if (fx.error) {
      issues.push({
        code: "cotizacion_no_disponible",
        message: `No se pudo obtener la cotización: ${fx.error}.`,
        severity: "warning",
      });
    }

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
