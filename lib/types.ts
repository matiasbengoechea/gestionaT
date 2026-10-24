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

/** Campos de la ficha contable que no forman parte del comprobante original. */
export interface RowExtras {
  /** Cuenta del proveedor / acreedor. */
  cuenta: string;
  cuentaTesoreria: string;
  /** DD/MM/AAAA */
  fechaAsiento: string;
  /** DD/MM/AAAA */
  fechaOperacion: string;
  textoIdentif: string;
  tfn1: string;
  tfn2: string;
  rectificativa: boolean;
  observaciones: string;
  descripcion: string;
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
