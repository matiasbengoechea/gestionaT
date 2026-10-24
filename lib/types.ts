export type InvoiceStatus =
  | "pending"
  | "processing"
  | "ready"
  | "review"
  | "approved"
  | "error";

export interface Party {
  razonSocial: string;
  cuit: string;
  condicionIva: string;
  domicilio: string;
}

export interface InvoiceItem {
  /** Descripción normalizada y traducida al español. */
  descripcion: string;
  /** Texto tal cual figura en el comprobante (para auditar la traducción). */
  descripcionOriginal: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  /** Alícuota de IVA en porcentaje: 21, 10.5, 27, 0. */
  alicuotaIva: number;
  importe: number;
  /** Código sugerido del plan de cuentas del cliente. */
  cuentaContable: string;
}

export interface TaxLine {
  tipo: string;
  base: number;
  alicuota: number;
  importe: number;
}

export interface InvoiceData {
  tipoComprobante: string;
  /**
   * `local`: comprobante AFIP (CUIT + CAE).
   * `exterior`: proveedor del exterior (VAT/NIF, sin CAE ni CUIT).
   */
  origen: "local" | "exterior";
  puntoDeVenta: string;
  numero: string;
  /** ISO `YYYY-MM-DD`. */
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  emisor: Party;
  receptor: Party;
  /** Código ISO 4217: ARS, USD, EUR... */
  moneda: string;
  tipoCambio: number | null;
  items: InvoiceItem[];
  subtotal: number;
  impuestos: TaxLine[];
  percepciones: TaxLine[];
  /** Retenciones sufridas (Ganancias, IIBB, IVA). No modifican el total del comprobante. */
  retenciones?: TaxLine[];
  /** El CUIT/NIF del emisor fue generado por el sistema porque no figuraba en el documento. */
  emisorIdProvisorio?: boolean;
  /** El CUIT/NIF del receptor fue generado por el sistema porque no figuraba en el documento. */
  receptorIdProvisorio?: boolean;
  total: number;
  cae: string | null;
  caeVencimiento: string | null;
  /** Idioma detectado en el comprobante original. */
  idiomaOriginal: string;
  observaciones: string;
  /** Campos que el modelo no pudo leer con certeza. */
  camposDudosos: string[];
  /** Confianza global de la extracción, de 0 a 1. */
  confianza: number;
}

/**
 * Línea editable de la grilla de desglose impositivo y contable.
 * Los importes viajan como texto para poder editarse sin perder lo tipeado.
 */
export interface GridLine {
  /** Código de operación (alícuota del Libro IVA Digital, o EXT para el exterior). */
  op: string;
  /** Neto gravado. */
  base: string;
  /** IVA | Exento | No gravado | Exterior. */
  tipo: string;
  /** Alícuota de IVA en porcentaje. */
  iva: string;
  /** Percepciones de IIBB / IVA. */
  recargo: string;
  tipoRet: string;
  retencion: string;
  /** Régimen / impreso: Libro IVA Digital / F.2002, Exterior. */
  regimen: string;
  /** Cuenta de gasto/ingreso sugerida. */
  contrapartida: string;
}

/** Campos de la ficha "Detalle de factura" tal como los edita el usuario. */
export interface RowForm {
  tipoCompAfip: string;
  nroFactura: string;
  /** DD/MM/AAAA */
  fechaFactura: string;
  /** DD/MM/AAAA */
  fechaAsiento: string;
  /** DD/MM/AAAA */
  fechaOperacion: string;
  proveedor: string;
  /** Cuenta del proveedor / acreedor. */
  cuenta: string;
  cuentaTesoreria: string;
  /** Rectificativa / nota de crédito: invierte el signo del asiento. */
  rectificativa: boolean;
  moneda: string;
  tipoCambio: string;
  total: string;
  cuit: string;
  concepto: string;
  textoIdentif: string;
  tfn1: string;
  tfn2: string;
  ajustes: string;
  observaciones: string;
  descripcion: string;
  grid: GridLine[];
}

export type IssueSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  code: string;
  message: string;
  severity: IssueSeverity;
}

export interface ExtractionMeta {
  provider: string;
  model: string;
  durationMs: number;
}

export interface ExtractionResponse {
  ok: true;
  invoice: InvoiceData;
  issues: ValidationIssue[];
  meta: ExtractionMeta;
}

export interface ErrorResponse {
  ok: false;
  code: string;
  error: string;
}
