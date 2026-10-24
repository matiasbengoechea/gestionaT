import type { InvoiceData } from "./types";

/**
 * Cotizaciones de moneda extranjera a pesos.
 *
 * El modelo nunca inventa una cotización: la trae este módulo, con fuente y
 * fecha, y queda registrada en la factura.
 *
 * Fuentes:
 * - ArgentinaDatos: histórico del dólar por casa (oficial, blue, MEP, ...).
 * - Frankfurter (BCE): tipos de referencia para el cruce de otras monedas.
 */

export interface FxQuote {
  moneda: string;
  /** Fecha efectiva de la cotización (puede ser el último día hábil). */
  fecha: string;
  /** Pesos por una unidad de la moneda. */
  valor: number;
  fuente: string;
  tipo: string;
  cruz?: { par: string; valor: number; fecha: string; fuente: string };
}

const TIMEOUT_MS = 8000;
const MAX_LOOKBACK_DAYS = 7;
const cache = new Map<string, FxQuote | null>();

function fxConfig() {
  return {
    enabled: (process.env.FX_ENABLED ?? "true").trim().toLowerCase() !== "false",
    tipo: (process.env.FX_TIPO ?? "oficial").trim().toLowerCase(),
    lado: (process.env.FX_LADO ?? "venta").trim().toLowerCase() === "compra" ? "compra" : "venta",
  };
}

function shiftDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Dólar (o la casa configurada) en pesos, para una fecha. */
async function usdArs(fecha: string): Promise<{ valor: number; fecha: string } | null> {
  const { tipo, lado } = fxConfig();

  for (let offset = 0; offset < MAX_LOOKBACK_DAYS; offset += 1) {
    const day = shiftDate(fecha, -offset);
    const [year, month, date] = day.split("-");
    const data = await fetchJson(
      `https://api.argentinadatos.com/v1/cotizaciones/dolares/${tipo}/${year}/${month}/${date}`,
    );
    const value = data?.[lado];
    if (typeof value === "number" && value > 0) {
      return { valor: value, fecha: typeof data?.fecha === "string" ? data.fecha : day };
    }
  }

  return null;
}

/** Cuántos dólares vale una unidad de `moneda`, según el BCE. */
async function crossToUsd(
  moneda: string,
  fecha: string,
): Promise<{ valor: number; fecha: string } | null> {
  for (let offset = 0; offset < MAX_LOOKBACK_DAYS; offset += 1) {
    const day = shiftDate(fecha, -offset);
    const data = await fetchJson(
      `https://api.frankfurter.app/${day}?from=${encodeURIComponent(moneda)}&to=USD`,
    );
    const rates = data?.rates as Record<string, unknown> | undefined;
    const value = rates?.USD;
    if (typeof value === "number" && value > 0) {
      return { valor: value, fecha: typeof data?.date === "string" ? data.date : day };
    }
  }

  return null;
}

export async function getFxQuote(moneda: string, fecha: string): Promise<FxQuote | null> {
  const currency = moneda.trim().toUpperCase();
  if (!currency) return null;
  if (currency === "ARS") {
    return { moneda: "ARS", fecha, valor: 1, fuente: "Peso argentino", tipo: "n/a" };
  }

  const key = `${currency}:${fecha}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const { tipo, lado } = fxConfig();
  const usd = await usdArs(fecha);
  if (!usd) {
    cache.set(key, null);
    return null;
  }

  if (currency === "USD") {
    const quote: FxQuote = {
      moneda: "USD",
      fecha: usd.fecha,
      valor: usd.valor,
      fuente: `ArgentinaDatos (${tipo}, ${lado})`,
      tipo,
    };
    cache.set(key, quote);
    return quote;
  }

  const cross = await crossToUsd(currency, fecha);
  if (!cross) {
    cache.set(key, null);
    return null;
  }

  const quote: FxQuote = {
    moneda: currency,
    fecha: usd.fecha,
    valor: Math.round(cross.valor * usd.valor * 10000) / 10000,
    fuente: `ArgentinaDatos (${tipo}, ${lado}) × Frankfurter (${currency}/USD)`,
    tipo,
    cruz: {
      par: `${currency}/USD`,
      valor: cross.valor,
      fecha: cross.fecha,
      fuente: "Frankfurter (BCE)",
    },
  };
  cache.set(key, quote);
  return quote;
}

/**
 * Completa la cotización de la factura si falta, y guarda la de mercado para
 * poder compararla con la que el comprobante tenga impresa.
 */
export async function applyFx(invoice: InvoiceData): Promise<InvoiceData> {
  const { enabled } = fxConfig();
  if (!enabled) return invoice;
  if (invoice.moneda.trim().toUpperCase() === "ARS") return invoice;
  if (!invoice.fechaEmision) return invoice;

  const quote = await getFxQuote(invoice.moneda, invoice.fechaEmision);
  if (!quote) return invoice;

  return {
    ...invoice,
    tipoCambio: invoice.tipoCambio ?? quote.valor,
    tipoCambioFuente: quote.fuente,
    tipoCambioFecha: quote.fecha,
    tipoCambioMercado: quote.valor,
  };
}
