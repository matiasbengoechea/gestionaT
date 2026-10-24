import { normalizeCuit } from "../cuit";
import type { InvoiceData, InvoiceItem, Party, TaxLine } from "../types";

/**
 * Convierte un valor devuelto por el modelo en número.
 * Soporta "1.234,56", "1,234.56", "$ 1.234,56" y números ya numéricos.
 */
export function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;

  let text = value.trim().replace(/[^\d.,-]/g, "");
  if (!text) return 0;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    const decimals = text.length - lastComma - 1;
    // "1,234" con 3 decimales y más de 4 caracteres suele ser separador de miles.
    text = decimals === 3 && text.length > 4 ? text.replace(/,/g, "") : text.replace(",", ".");
  } else if (lastDot > -1) {
    // Convención argentina: "21.000" es veintiún mil, no veintiuno coma cero.
    const decimals = text.length - lastDot - 1;
    const integerPart = text.slice(0, lastDot);
    if (decimals === 3 && integerPart !== "0" && integerPart !== "-0") {
      text = text.replace(/\./g, "");
    }
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

/** Normaliza fechas a `YYYY-MM-DD`. */
export function toISODate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const local = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (local) {
    const [, day, month, rawYear] = local;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

function normalizeParty(raw: unknown): Party {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    razonSocial: toText(value.razonSocial),
    cuit: toText(value.cuit),
    condicionIva: toText(value.condicionIva),
    domicilio: toText(value.domicilio),
  };
}

function normalizeItem(raw: unknown): InvoiceItem {
  const value = (raw ?? {}) as Record<string, unknown>;
  const cantidad = toNumber(value.cantidad);
  const precioUnitario = toNumber(value.precioUnitario);
  const importeInformado = toNumber(value.importe);

  return {
    descripcion: toText(value.descripcion),
    descripcionOriginal: toText(value.descripcionOriginal) || toText(value.descripcion),
    cantidad: cantidad || 1,
    unidad: toText(value.unidad) || "unidad",
    precioUnitario,
    alicuotaIva: toNumber(value.alicuotaIva),
    importe:
      importeInformado ||
      Math.round((cantidad || 1) * precioUnitario * 100) / 100,
    cuentaContable: toText(value.cuentaContable),
  };
}

function normalizeTax(raw: unknown): TaxLine {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    tipo: toText(value.tipo),
    base: toNumber(value.base),
    alicuota: toNumber(value.alicuota),
    importe: toNumber(value.importe),
  };
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Asegura que el JSON del modelo cumpla exactamente con `InvoiceData`. */
export function normalizeInvoice(raw: unknown): InvoiceData {
  const value = (raw ?? {}) as Record<string, unknown>;

  const emisor = normalizeParty(value.emisor);
  const origenRaw = toText(value.origen).toLowerCase();
  const origen: "local" | "exterior" =
    origenRaw === "exterior"
      ? "exterior"
      : origenRaw === "local"
        ? "local"
        : normalizeCuit(emisor.cuit).length === 11
          ? "local"
          : "exterior";

  if (origen === "exterior" && !emisor.condicionIva) {
    emisor.condicionIva = "Exterior";
  }

  const items = toArray(value.items).map(normalizeItem);
  const impuestos = toArray(value.impuestos).map(normalizeTax);
  const percepciones = toArray(value.percepciones).map(normalizeTax);

  const subtotalInformado = toNumber(value.subtotal);
  const subtotal =
    subtotalInformado ||
    Math.round(items.reduce((acc, item) => acc + item.importe, 0) * 100) / 100;

  const impuestosTotal = impuestos.reduce((acc, line) => acc + line.importe, 0);
  const percepcionesTotal = percepciones.reduce((acc, line) => acc + line.importe, 0);
  const totalInformado = toNumber(value.total);
  const total =
    totalInformado ||
    Math.round((subtotal + impuestosTotal + percepcionesTotal) * 100) / 100;

  const confianzaRaw = toNumber(value.confianza);
  const confianza = Math.min(1, Math.max(0, confianzaRaw > 1 ? confianzaRaw / 100 : confianzaRaw));

  return {
    tipoComprobante: toText(value.tipoComprobante) || "Otro",
    origen,
    puntoDeVenta: toText(value.puntoDeVenta),
    numero: toText(value.numero),
    fechaEmision: toISODate(value.fechaEmision),
    fechaVencimiento: toISODate(value.fechaVencimiento),
    emisor,
    receptor: normalizeParty(value.receptor),
    moneda: (toText(value.moneda) || "ARS").toUpperCase(),
    tipoCambio: value.tipoCambio == null ? null : toNumber(value.tipoCambio) || null,
    items,
    subtotal,
    impuestos,
    percepciones,
    retenciones: toArray(value.retenciones).map(normalizeTax),
    total,
    cae: toText(value.cae) || null,
    caeVencimiento: toISODate(value.caeVencimiento),
    idiomaOriginal: toText(value.idiomaOriginal) || "español",
    observaciones: toText(value.observaciones),
    camposDudosos: toArray(value.camposDudosos).map(toText).filter(Boolean),
    confianza: Number.isFinite(confianza) ? confianza : 0.5,
  };
}
