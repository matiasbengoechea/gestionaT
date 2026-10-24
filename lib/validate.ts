import { isValidCuit, normalizeCuit } from "./cuit";
import type { ClientProfile } from "./clients";
import { provisionalIdIssues } from "./provisional-id";
import type { InvoiceData, TaxLine, ValidationIssue } from "./types";

const TOLERANCE = 0.05;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sumItems(data: InvoiceData): number {
  return round2(data.items.reduce((acc, item) => acc + (item.importe || 0), 0));
}

export function sumTaxes(lines: TaxLine[]): number {
  return round2(lines.reduce((acc, line) => acc + (line.importe || 0), 0));
}

/** Total calculado a partir de los ítems y los impuestos. */
export function calculatedTotal(data: InvoiceData): number {
  return round2(sumItems(data) + sumTaxes(data.impuestos) + sumTaxes(data.percepciones));
}

/** Clave de identidad fiscal de un comprobante, para detectar duplicados. */
export function invoiceKey(data: InvoiceData): string {
  return [
    normalizeCuit(data.emisor.cuit),
    data.tipoComprobante.trim().toLowerCase(),
    data.puntoDeVenta.trim(),
    data.numero.trim(),
  ].join("|");
}

/** Resuelve un path tipo `emisor.cuit` dentro de la factura. */
function fieldValue(data: InvoiceData, path: string): unknown {
  let current: unknown = data;
  for (const part of path.split(".")) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Un campo vacío no se revisa: no hay valor que corregir. Los faltantes
 * críticos ya tienen su propio control (CUIT, CAE, fecha, cotización).
 */
function hasValue(data: InvoiceData, path: string): boolean {
  const value = fieldValue(data, path);
  if (value === undefined) return true;
  if (value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function isFutureDate(iso: string | null): boolean {
  if (!iso) return false;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return date.getTime() > tomorrow.getTime();
}

function isPastDate(iso: string | null): boolean {
  if (!iso) return false;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 2);
  return date.getTime() < limit.getTime();
}

/**
 * Reglas de control que replican la revisión que hoy hace un administrativo.
 * Es código isomórfico: se usa tanto en el servidor como en el cliente
 * (para revalidar cuando el usuario edita un campo).
 */
export function validateInvoice(
  data: InvoiceData,
  client: ClientProfile | undefined,
  knownKeys: string[] = [],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const esExterior = data.origen === "exterior";

  // --- Identificación fiscal ---
  if (!data.emisor.razonSocial.trim()) {
    issues.push({
      code: "emisor_sin_razon_social",
      message: "No se pudo leer la razón social del emisor.",
      severity: "error",
    });
  }

  if (!data.numero.trim()) {
    issues.push({
      code: "numero_faltante",
      message: "Número de factura no encontrado.",
      severity: "error",
    });
  }

  issues.push(...provisionalIdIssues(data));

  if (data.emisorIdProvisorio) {
    // El identificador ya fue generado y se informa en las incidencias.
  } else if (esExterior) {
    if (!data.emisor.cuit.trim()) {
      issues.push({
        code: "id_fiscal_exterior_faltante",
        message:
          "No se pudo leer la identificación fiscal (VAT/NIF) del proveedor del exterior.",
        severity: "warning",
      });
    }
    issues.push({
      code: "comprobante_exterior",
      message:
        "Operación internacional sujeta a validación AFIP: no se valida CUIT ni CAE. Verificá la cotización aplicada.",
      severity: "info",
    });
  } else if (!isValidCuit(data.emisor.cuit)) {
    issues.push({
      code: "cuit_emisor_invalido",
      message: `El CUIT del emisor (${data.emisor.cuit || "vacío"}) no pasa la validación de dígito verificador.`,
      severity: "error",
    });
  }

  if (!data.receptorIdProvisorio && !isValidCuit(data.receptor.cuit)) {
    issues.push({
      code: "cuit_receptor_invalido",
      message: `El CUIT del receptor (${data.receptor.cuit || "vacío"}) no pasa la validación de dígito verificador.`,
      severity: "warning",
    });
  }

  if (
    client &&
    isValidCuit(data.receptor.cuit) &&
    normalizeCuit(data.receptor.cuit) !== normalizeCuit(client.cuit)
  ) {
    issues.push({
      code: "receptor_distinto_al_cliente",
      message: `La factura está emitida a nombre de "${data.receptor.razonSocial || "otro contribuyente"}", no de ${client.nombre}. Verificá que corresponda al cliente seleccionado.`,
      severity: "warning",
    });
  }

  // --- Coherencia de importes ---
  const itemsTotal = sumItems(data);
  if (data.items.length > 0 && Math.abs(itemsTotal - data.subtotal) > TOLERANCE) {
    issues.push({
      code: "subtotal_no_coincide",
      message: `La suma de los ítems (${itemsTotal.toFixed(2)}) no coincide con el subtotal informado (${data.subtotal.toFixed(2)}).`,
      severity: "warning",
    });
  }

  const expectedTotal = calculatedTotal(data);
  if (Math.abs(expectedTotal - data.total) > TOLERANCE) {
    issues.push({
      code: "total_no_coincide",
      message: `El total calculado (${expectedTotal.toFixed(2)}) no coincide con el total del comprobante (${data.total.toFixed(2)}).`,
      severity: "error",
    });
  }

  data.items.forEach((item, index) => {
    if (item.cantidad > 0 && item.precioUnitario > 0) {
      const expected = round2(item.cantidad * item.precioUnitario);
      if (Math.abs(expected - item.importe) > TOLERANCE) {
        issues.push({
          code: "item_importe_no_coincide",
          message: `Ítem ${index + 1} ("${item.descripcion || "sin descripción"}"): cantidad × precio = ${expected.toFixed(2)}, pero el importe informado es ${item.importe.toFixed(2)}.`,
          severity: "warning",
        });
      }
    }
  });

  // --- Fechas ---
  if (!data.fechaEmision) {
    issues.push({
      code: "fecha_emision_faltante",
      message: "No se pudo determinar la fecha de emisión.",
      severity: "error",
    });
  } else if (isFutureDate(data.fechaEmision)) {
    issues.push({
      code: "fecha_futura",
      message: `La fecha de emisión (${data.fechaEmision}) es posterior a hoy.`,
      severity: "warning",
    });
  } else if (isPastDate(data.fechaEmision)) {
    issues.push({
      code: "fecha_antigua",
      message: `La fecha de emisión (${data.fechaEmision}) tiene más de dos años. Revisá que no sea un comprobante ya contabilizado.`,
      severity: "info",
    });
  }

  // --- Datos fiscales obligatorios ---
  const requiresCae =
    !esExterior && /^factura|^nota de (crédito|débito)/i.test(data.tipoComprobante);
  if (requiresCae && !data.cae) {
    issues.push({
      code: "cae_faltante",
      message: "El comprobante no tiene CAE visible. Sin CAE no puede contabilizarse.",
      severity: "error",
    });
  }

  if (data.moneda && data.moneda.toUpperCase() !== "ARS" && !data.tipoCambio) {
    issues.push({
      code: "tipo_cambio_faltante",
      message: `El comprobante está en ${data.moneda} y no se informó el tipo de cambio.`,
      severity: "warning",
    });
  }

  // --- Duplicados ---
  if (knownKeys.includes(invoiceKey(data))) {
    issues.push({
      code: "comprobante_duplicado",
      message: "Ya existe una factura aprobada con el mismo emisor, tipo, punto de venta y número.",
      severity: "error",
    });
  }

  // --- Señales del modelo ---
  for (const field of data.camposDudosos) {
    if (!hasValue(data, field)) continue;
    issues.push({
      code: "campo_dudoso",
      message: `Lectura poco confiable en: ${field}.`,
      severity: "warning",
    });
  }

  if (data.confianza < 0.75) {
    issues.push({
      code: "confianza_baja",
      message: `Confianza de la extracción baja (${Math.round(data.confianza * 100)}%). Conviene revisar el comprobante original.`,
      severity: "warning",
    });
  }

  return issues;
}

export function deriveStatus(
  issues: ValidationIssue[],
  confianza: number,
): "ready" | "review" {
  const hasBlocking = issues.some(
    (issue) => issue.severity === "error" || issue.severity === "warning",
  );
  return hasBlocking || confianza < 0.75 ? "review" : "ready";
}
