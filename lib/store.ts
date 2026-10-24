import type { InvoiceData, ValidationIssue } from "./types";

/**
 * Persistencia de facturas recibidas.
 *
 * Backends:
 * - Supabase (PostgREST) si están `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
 * - Memoria del proceso como fallback para desarrollo y demo.
 *
 * Tabla esperada en Supabase:
 *
 *   create table invoices (
 *     id text primary key,
 *     recibido_en timestamptz not null default now(),
 *     origen text not null,
 *     remitente text,
 *     asunto text,
 *     file_name text,
 *     client_id text,
 *     invoice jsonb not null,
 *     issues jsonb not null,
 *     provider text,
 *     model text,
 *     duration_ms int
 *   );
 */

export interface StoredInvoice {
  id: string;
  recibidoEn: string;
  origen: "email" | "web";
  remitente?: string;
  asunto?: string;
  fileName: string;
  /** Ruta del archivo original dentro del bucket `invoices`. */
  filePath?: string;
  /** URL firmada, calculada al leer. */
  fileUrl?: string;
  clientId: string;
  invoice: InvoiceData;
  issues: ValidationIssue[];
  provider: string;
  model: string;
  durationMs: number;
}

const memory: StoredInvoice[] = [];
const MAX_MEMORY = 200;

function supabaseConfig(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  return url && key ? { url, key } : null;
}

export function storageBackend(): "supabase" | "memory" {
  return supabaseConfig() ? "supabase" : "memory";
}

/** Sube el archivo original al bucket privado `invoices`. */
export async function uploadInvoiceFile(
  path: string,
  base64: string,
  mimeType: string,
): Promise<string | null> {
  const config = supabaseConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/storage/v1/object/invoices/${path}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": mimeType,
      "x-upsert": "true",
    },
    body: Buffer.from(base64, "base64"),
  });

  return response.ok ? path : null;
}

/** URL firmada (temporal) para ver el archivo original. */
export async function signedFileUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const config = supabaseConfig();
  if (!config) return null;

  const response = await fetch(`${config.url}/storage/v1/object/sign/invoices/${path}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn }),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as { signedURL?: string };
  if (!payload.signedURL) return null;
  return `${config.url}/storage/v1${payload.signedURL}`;
}

export async function saveInvoice(record: StoredInvoice): Promise<void> {
  const config = supabaseConfig();

  if (config) {
    const response = await fetch(`${config.url}/rest/v1/invoices`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        id: record.id,
        recibido_en: record.recibidoEn,
        origen: record.origen,
        remitente: record.remitente ?? null,
        asunto: record.asunto ?? null,
        file_name: record.fileName,
        file_path: record.filePath ?? null,
        client_id: record.clientId,
        invoice: record.invoice,
        issues: record.issues,
        provider: record.provider,
        model: record.model,
        duration_ms: record.durationMs,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Supabase rechazó el guardado: HTTP ${response.status} ${detail.slice(0, 200)}`,
      );
    }
    return;
  }

  memory.unshift(record);
  if (memory.length > MAX_MEMORY) memory.length = MAX_MEMORY;
}

export async function listInvoices(
  limit = 100,
  since?: string,
): Promise<{ invoices: StoredInvoice[]; error?: string }> {
  const config = supabaseConfig();

  if (config) {
    try {
      const params = new URLSearchParams({
        select: "*",
        order: "recibido_en.desc",
        limit: String(limit),
      });
      // `gte` (y no `gt`) para no perder facturas con el mismo timestamp que la última vista.
      if (since) params.set("recibido_en", `gte.${since}`);

      const response = await fetch(`${config.url}/rest/v1/invoices?${params.toString()}`, {
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
        cache: "no-store",
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return {
          invoices: [],
          error: `Supabase HTTP ${response.status}: ${detail.slice(0, 200)}`,
        };
      }

      const rows = (await response.json()) as Array<Record<string, unknown>>;
      const invoices: StoredInvoice[] = rows.map((row) => ({
          id: String(row.id),
          recibidoEn: String(row.recibido_en ?? ""),
          origen: row.origen === "email" ? "email" : "web",
          remitente: row.remitente ? String(row.remitente) : undefined,
          asunto: row.asunto ? String(row.asunto) : undefined,
          fileName: String(row.file_name ?? ""),
          filePath: row.file_path ? String(row.file_path) : undefined,
          clientId: String(row.client_id ?? ""),
          invoice: row.invoice as InvoiceData,
          issues: (row.issues ?? []) as ValidationIssue[],
          provider: String(row.provider ?? ""),
          model: String(row.model ?? ""),
          durationMs: Number(row.duration_ms ?? 0),
        }));

      await Promise.all(
        invoices.map(async (invoice) => {
          if (!invoice.filePath) return;
          invoice.fileUrl = (await signedFileUrl(invoice.filePath)) ?? undefined;
        }),
      );

      return { invoices };
    } catch (error) {
      return {
        invoices: [],
        error: error instanceof Error ? error.message : "error de red",
      };
    }
  }

  const rows = since ? memory.filter((record) => record.recibidoEn >= since) : memory;
  return { invoices: rows.slice(0, limit) };
}
