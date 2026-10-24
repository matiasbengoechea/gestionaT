/**
 * Prueba el motor de extracción contra archivos locales, sin pasar por la web.
 *
 * Uso:
 *   pnpm extract samples/factura-a-aceros.pdf
 *   pnpm extract samples/*.pdf --client=metalurgica-aconcagua
 *   pnpm extract samples/*.pdf --model=google/gemini-4-argon
 *   pnpm extract samples/factura-a-aceros.pdf --json
 */

import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { extractInvoice } from "../lib/ai";
import { getClient } from "../lib/clients";
import { applyFx } from "../lib/fx";
import { formatDateAR } from "../lib/ui-mapping";
import { validateInvoice } from "../lib/validate";
import type { InvoiceData } from "../lib/types";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

interface Args {
  files: string[];
  clientId: string;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  const files: string[] = [];
  let clientId = "metalurgica-aconcagua";
  let json = false;

  for (const arg of argv) {
    if (arg.startsWith("--client=")) {
      clientId = arg.slice("--client=".length);
    } else if (arg.startsWith("--model=")) {
      const model = arg.slice("--model=".length);
      process.env.OPENROUTER_MODEL = model;
      process.env.GEMINI_MODEL = model;
      process.env.OPENAI_MODEL = model;
    } else if (arg === "--json") {
      json = true;
    } else {
      files.push(arg);
    }
  }

  return { files, clientId, json };
}

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency || "ARS",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function printReport(
  file: string,
  invoice: InvoiceData,
  issues: ReturnType<typeof validateInvoice>,
  meta: { provider: string; model: string; durationMs: number },
) {
  const line = "─".repeat(72);
  console.log(`\n${line}`);
  console.log(`📄 ${file}`);
  console.log(`   ${meta.provider} · ${meta.model} · ${(meta.durationMs / 1000).toFixed(1)} s`);

  const numero = invoice.puntoDeVenta
    ? `${invoice.puntoDeVenta}-${invoice.numero}`
    : invoice.numero;
  console.log(`\n   Comprobante : ${invoice.tipoComprobante} ${numero}`);
  console.log(`   Origen      : ${invoice.origen}`);
  console.log(`   Fecha       : ${formatDateAR(invoice.fechaEmision)}   Vto: ${formatDateAR(invoice.fechaVencimiento)}`);
  console.log(
    `   Emisor      : ${invoice.emisor.razonSocial} · ${invoice.emisor.cuit || "sin id fiscal"} · ${invoice.emisor.condicionIva}`,
  );
  console.log(
    `   Receptor    : ${invoice.receptor.razonSocial} · ${invoice.receptor.cuit}`,
  );
  console.log(
    `   Moneda      : ${invoice.moneda}${
      invoice.tipoCambio
        ? ` · cotización ${invoice.tipoCambio}${
            invoice.tipoCambioFuente
              ? ` (${invoice.tipoCambioFuente}, ${invoice.tipoCambioFecha})`
              : ""
          }`
        : ""
    }`,
  );

  console.log(`\n   Ítems (${invoice.items.length}):`);
  for (const [index, item] of invoice.items.entries()) {
    console.log(`   ${index + 1}. ${item.descripcion}`);
    if (item.descripcionOriginal && item.descripcionOriginal !== item.descripcion) {
      console.log(`      original: ${item.descripcionOriginal}`);
    }
    console.log(
      `      ${item.cantidad} ${item.unidad} × ${money(item.precioUnitario, invoice.moneda)} = ${money(item.importe, invoice.moneda)} · IVA ${item.alicuotaIva}% · cuenta ${item.cuentaContable || "—"}`,
    );
  }

  console.log(`\n   Subtotal    : ${money(invoice.subtotal, invoice.moneda)}`);
  for (const tax of invoice.impuestos) {
    console.log(`   ${tax.tipo.padEnd(12)}: ${money(tax.importe, invoice.moneda)}`);
  }
  for (const tax of invoice.percepciones) {
    console.log(`   ${tax.tipo.padEnd(12)}: ${money(tax.importe, invoice.moneda)}`);
  }
  console.log(`   TOTAL       : ${money(invoice.total, invoice.moneda)}`);
  console.log(`   CAE         : ${invoice.cae ?? "—"}`);
  console.log(
    `   Confianza   : ${Math.round(invoice.confianza * 100)}%   Idioma: ${invoice.idiomaOriginal}`,
  );

  if (invoice.observaciones) {
    console.log(`   Observación : ${invoice.observaciones}`);
  }

  if (issues.length === 0) {
    console.log(`\n   ✅ Sin incidencias`);
  } else {
    console.log(`\n   Incidencias (${issues.length}):`);
    for (const issue of issues) {
      const icon = issue.severity === "error" ? "⛔" : issue.severity === "warning" ? "⚠️ " : "ℹ️ ";
      console.log(`   ${icon} [${issue.code}] ${issue.message}`);
    }
  }
}

async function main() {
  const { files, clientId, json } = parseArgs(process.argv.slice(2));

  if (files.length === 0) {
    console.error("Uso: pnpm extract <archivo...> [--client=id] [--model=id] [--json]");
    process.exit(1);
  }

  const client = getClient(clientId);
  if (!client) {
    console.error(`Cliente desconocido: ${clientId}`);
    process.exit(1);
  }

  console.log(`Cliente: ${client.nombre} (${client.cuit}) · ${client.rubro}`);

  let failures = 0;
  const startedAll = Date.now();

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    const mimeType = MIME[ext];
    if (!mimeType) {
      console.error(`\n✗ ${file}: formato no soportado (${ext})`);
      failures += 1;
      continue;
    }

    const started = Date.now();
    try {
      const base64 = readFileSync(file).toString("base64");
      const { invoice, provider, model } = await extractInvoice(
        { base64, mimeType, fileName: basename(file) },
        client,
      );
      const enriched = await applyFx(invoice);
      const issues = validateInvoice(enriched, client, []);
      const meta = { provider, model, durationMs: Date.now() - started };

      if (json) {
        console.log(
          JSON.stringify({ file, meta, invoice: enriched, issues }, null, 2),
        );
      } else {
        printReport(file, enriched, issues, meta);
      }
    } catch (error) {
      failures += 1;
      console.error(`\n✗ ${file}: ${error instanceof Error ? error.message : error}`);
    }
  }

  const total = Date.now() - startedAll;
  console.log(
    `\n${"═".repeat(72)}\n${files.length - failures}/${files.length} procesadas en ${(total / 1000).toFixed(1)} s`,
  );

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
