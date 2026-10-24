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

export interface FxResult {
  quote: FxQuote | null;
  /** Motivo cuando no se pudo obtener la cotización. */
  reason?: string;
}

export interface FxApplyResult {
  invoice: InvoiceData;
  error?: string;
}

const TIMEOUT_MS = 8000;
const MAX_LOOKBACK_DAYS = 7;
const cache = new Map<string, FxResult>();

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

interface FetchResult {
  data: Record<string, unknown> | null;
  error?: string;
}

async function fetchJson(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return { data: null, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    return { data: data && typeof data === "object" ? (data as Record<string, unknown>) : null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "error de red";
    return { data: null, error: message };
  }
}

type RateResult = { ok: true; valor: number; fecha: string } | { ok: false; error: string };

/** Dólar (o la casa configurada) en pesos, para una fecha. */
async function usdArs(fecha: string): Promise<RateResult> {
  const { tipo, lado } = fxConfig();
  let lastError = "sin datos";

  for (let offset = 0; offset < MAX_LOOKBACK_DAYS; offset += 1) {
    const day = shiftDate(fecha, -offset);
    const [year, month, date] = day.split("-");
    const result = await fetchJson(
      `https://api.argentinadatos.com/v1/cotizaciones/dolares/${tipo}/${year}/${month}/${date}`,
    );
    if (result.error) {
      lastError = result.error;
      continue;
    }
    const value = result.data?.[lado];
    if (typeof value === "number" && value > 0) {
      return {
        ok: true,
        valor: value,
        fecha: typeof result.data?.fecha === "string" ? result.data.fecha : day,
      };
    }
    lastError = `sin valor "${lado}"`;
  }

  return { ok: false, error: `ArgentinaDatos (${tipo}): ${lastError}` };
}

/** Cuántos dólares vale una unidad de `moneda`, según el BCE. */
async function crossToUsd(moneda: string, fecha: string): Promise<RateResult> {
  let lastError = "sin datos";

  for (let offset = 0; offset < MAX_LOOKBACK_DAYS; offset += 1) {
    const day = shiftDate(fecha, -offset);
    const result = await fetchJson(
      `https://api.frankfurter.app/${day}?from=${encodeURIComponent(moneda)}&to=USD`,
    );
    if (result.error) {
      lastError = result.error;
      continue;
    }
    const rates = result.data?.rates as Record<string, unknown> | undefined;
    const value = rates?.USD;
    if (typeof value === "number" && value > 0) {
      return {
        ok: true,
        valor: value,
        fecha: typeof result.data?.date === "string" ? result.data.date : day,
      };
    }
    lastError = "sin rate USD";
  }

  return { ok: false, error: `Frankfurter (${moneda}/USD): ${lastError}` };
}

export async function resolveFx(moneda: string, fecha: string): Promise<FxResult> {
  const currency = moneda.trim().toUpperCase();
  if (!currency) return { quote: null, reason: "moneda vacía" };
  if (currency === "ARS") {
    return {
      quote: { moneda: "ARS", fecha, valor: 1, fuente: "Peso argentino", tipo: "n/a" },
    };
  }

  const key = `${currency}:${fecha}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const { tipo, lado } = fxConfig();
  const usd = await usdArs(fecha);
  if (!usd.ok) {
    const result: FxResult = { quote: null, reason: usd.error };
    cache.set(key, result);
    return result;
  }

  if (currency === "USD") {
    const result: FxResult = {
      quote: {
        moneda: "USD",
        fecha: usd.fecha,
        valor: usd.valor,
        fuente: `ArgentinaDatos (${tipo}, ${lado})`,
        tipo,
      },
    };
    cache.set(key, result);
    return result;
  }

  const cross = await crossToUsd(currency, fecha);
  if (!cross.ok) {
    const result: FxResult = { quote: null, reason: cross.error };
    cache.set(key, result);
    return result;
  }

  const result: FxResult = {
    quote: {
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
    },
  };
  cache.set(key, result);
  return result;
}

export async function getFxQuote(moneda: string, fecha: string): Promise<FxQuote | null> {
  return (await resolveFx(moneda, fecha)).quote;
}

/**
 * Completa la cotización de la factura si falta, y guarda la de mercado para
 * poder compararla con la que el comprobante tenga impresa.
 */
export async function applyFx(invoice: InvoiceData): Promise<FxApplyResult> {
  const { enabled } = fxConfig();
  if (!enabled) return { invoice };
  if (invoice.moneda.trim().toUpperCase() === "ARS") return { invoice };
  if (!invoice.fechaEmision) {
    return { invoice, error: "la factura no tiene fecha de emisión" };
  }

  const { quote, reason } = await resolveFx(invoice.moneda, invoice.fechaEmision);
  if (!quote) {
    return { invoice, error: reason ?? "cotización no disponible" };
  }

  return {
    invoice: {
      ...invoice,
      tipoCambio: invoice.tipoCambio ?? quote.valor,
      tipoCambioFuente: quote.fuente,
      tipoCambioFecha: quote.fecha,
      tipoCambioMercado: quote.valor,
    },
  };
}
