import { NextResponse } from "next/server";
import { buildBatch, batchToCsv } from "@/lib/output/build";
import type { InvoiceData } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

interface OutputRequest {
  clientId?: string;
  invoices?: InvoiceData[];
}

function isInvoice(value: unknown): value is InvoiceData {
  if (!value || typeof value !== "object") return false;
  const invoice = value as Record<string, unknown>;
  return (
    typeof invoice.tipoComprobante === "string" &&
    typeof invoice.moneda === "string" &&
    typeof invoice.total === "number" &&
    Array.isArray(invoice.items)
  );
}

/**
 * Genera un lote de salida a partir de las facturas aprobadas.
 * Devuelve el lote canónico y el artefacto CSV listo para importar.
 */
export async function POST(request: Request) {
  let body: OutputRequest;
  try {
    body = (await request.json()) as OutputRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "El cuerpo de la solicitud no es JSON válido." },
      { status: 400 },
    );
  }

  const invoices = Array.isArray(body.invoices) ? body.invoices : [];
  if (invoices.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No hay facturas para enviar." },
      { status: 400 },
    );
  }

  const invalid = invoices.filter((invoice) => !isInvoice(invoice));
  if (invalid.length > 0) {
    return NextResponse.json(
      { ok: false, error: `${invalid.length} factura(s) con formato inválido.` },
      { status: 422 },
    );
  }

  const batch = buildBatch(invoices, body.clientId ?? "default");

  return NextResponse.json({
    ok: true,
    batch,
    csv: batchToCsv(batch),
  });
}
