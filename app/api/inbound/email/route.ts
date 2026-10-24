import { NextResponse } from "next/server";
import { extractInvoice } from "@/lib/ai";
import { CLIENTS, getClient } from "@/lib/clients";
import { applyFx } from "@/lib/fx";
import { parseInbound } from "@/lib/inbound/parse";
import { saveInvoice } from "@/lib/store";
import type { ValidationIssue } from "@/lib/types";
import { validateInvoice } from "@/lib/validate";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function newId(): string {
  return `mail-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}

/**
 * Webhook de email inbound.
 *
 * Configuración:
 * - `INBOUND_SECRET`: si está, exige `?secret=` o header `x-inbound-secret`.
 * - `INBOUND_ALLOWED_DOMAINS`: lista separada por comas; si está, filtra remitentes.
 */
export async function POST(request: Request) {
  const secret = (process.env.INBOUND_SECRET ?? "").trim();
  if (secret) {
    const url = new URL(request.url);
    const provided =
      request.headers.get("x-inbound-secret") ?? url.searchParams.get("secret") ?? "";
    if (provided !== secret) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }
  }

  const parsed = await parseInbound(request);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: "No se pudo interpretar el mail recibido." },
      { status: 400 },
    );
  }

  const allowedDomains = (process.env.INBOUND_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  if (allowedDomains.length > 0) {
    const domain = parsed.from.split("@")[1]?.toLowerCase() ?? "";
    if (!allowedDomains.includes(domain)) {
      return NextResponse.json(
        { ok: false, error: `Remitente no permitido: ${parsed.from || "desconocido"}.` },
        { status: 403 },
      );
    }
  }

  if (parsed.attachments.length === 0) {
    return NextResponse.json(
      { ok: false, error: "El mail no tiene adjuntos." },
      { status: 422 },
    );
  }

  const client = getClient(parsed.clientId) ?? CLIENTS[0];
  const resultados: Array<Record<string, unknown>> = [];

  for (const attachment of parsed.attachments) {
    if (!ALLOWED_TYPES.has(attachment.mimeType)) {
      resultados.push({
        fileName: attachment.filename,
        ok: false,
        error: `Formato no soportado (${attachment.mimeType}).`,
      });
      continue;
    }

    const size = Buffer.from(attachment.base64, "base64").length;
    if (size > MAX_BYTES) {
      resultados.push({
        fileName: attachment.filename,
        ok: false,
        error: `El adjunto supera los 4 MB (${(size / (1024 * 1024)).toFixed(1)} MB).`,
      });
      continue;
    }

    const startedAt = Date.now();

    try {
      const { invoice, provider, model } = await extractInvoice(
        {
          base64: attachment.base64,
          mimeType: attachment.mimeType,
          fileName: attachment.filename,
        },
        client,
      );

      const fx = await applyFx(invoice);
      const issues: ValidationIssue[] = validateInvoice(fx.invoice, client, []);
      if (fx.error) {
        issues.push({
          code: "cotizacion_no_disponible",
          message: `No se pudo obtener la cotización: ${fx.error}.`,
          severity: "warning",
        });
      }

      const record = {
        id: newId(),
        recibidoEn: new Date().toISOString(),
        origen: "email" as const,
        remitente: parsed.from,
        asunto: parsed.subject,
        fileName: attachment.filename,
        clientId: client.id,
        invoice: fx.invoice,
        issues,
        provider,
        model,
        durationMs: Date.now() - startedAt,
      };

      await saveInvoice(record);

      resultados.push({
        fileName: attachment.filename,
        ok: true,
        id: record.id,
        comprobante: `${fx.invoice.tipoComprobante} ${fx.invoice.puntoDeVenta}-${fx.invoice.numero}`,
        total: fx.invoice.total,
        moneda: fx.invoice.moneda,
        incidencias: issues.length,
      });
    } catch (error) {
      resultados.push({
        fileName: attachment.filename,
        ok: false,
        error: error instanceof Error ? error.message : "Error inesperado.",
      });
    }
  }

  const procesadas = resultados.filter((resultado) => resultado.ok).length;

  return NextResponse.json({
    ok: true,
    from: parsed.from,
    subject: parsed.subject,
    procesadas,
    total: resultados.length,
    resultados,
  });
}
