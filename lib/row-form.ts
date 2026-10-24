import type { ClientProfile, PlanCuenta } from "./clients";
import { applyProvisionalIds, isProvisionalId } from "./provisional-id";
import type { GridLine, InvoiceData, RowForm, TaxLine, ValidationIssue } from "./types";
import { formatDateAR, parseDateAR } from "./ui-mapping";
import { round2 } from "./validate";

export const TIPOS_COMPROBANTE = [
  "Factura A",
  "Factura B",
  "Factura C",
  "Factura M",
  "Factura E",
  "Exterior",
  "Otro",
] as const;

export const ALICUOTAS = ["21", "10.5", "27", "5", "2.5", "0"];
export const TIPOS_LINEA = ["IVA", "Exento", "No gravado", "Exterior"];
export const MONEDAS = ["ARS", "USD", "EUR", "GBP", "BRL"];

export const CUENTA_PROVEEDORES = "2.1.1.01";
export const CUENTA_PROVEEDORES_EXTERIOR = "2.1.1.02";
export const CUENTA_IVA_CREDITO = "1.2.1.01";
export const CUENTA_PERCEPCIONES = "1.2.1.02";
export const CUENTA_RETENCIONES = "2.1.3.01";

/** Cuentas de movimiento fijo que todo cliente necesita además de su plan propio. */
export const BASE_ACCOUNTS: PlanCuenta[] = [
  { cuenta: CUENTA_PROVEEDORES, descripcion: "Proveedores" },
  { cuenta: CUENTA_PROVEEDORES_EXTERIOR, descripcion: "Proveedores del exterior" },
  { cuenta: CUENTA_IVA_CREDITO, descripcion: "IVA Crédito Fiscal" },
  { cuenta: CUENTA_PERCEPCIONES, descripcion: "Percepciones de IVA e IIBB a favor" },
  { cuenta: CUENTA_RETENCIONES, descripcion: "Retenciones a depositar" },
];

export function accountsFor(client: ClientProfile | undefined): PlanCuenta[] {
  const seen = new Set<string>();
  const merged: PlanCuenta[] = [];
  for (const account of [...(client?.planCuentas ?? []), ...BASE_ACCOUNTS]) {
    if (seen.has(account.cuenta)) continue;
    seen.add(account.cuenta);
    merged.push(account);
  }
  return merged.sort((a, b) => a.cuenta.localeCompare(b.cuenta));
}

/** Importe en texto (`1.250,50`, `1250.50`, `700,00`) → número, o `null` si no es válido. */
export function parseAmount(text: string): number | null {
  const clean = text.trim().replace(/\s/g, "").replace(/^[A-Za-z$€£]+/, "");
  if (!clean) return null;
  let normalized = clean;
  const hasComma = clean.includes(",");
  const hasDot = clean.includes(".");
  if (hasComma && hasDot) {
    normalized =
      clean.lastIndexOf(",") > clean.lastIndexOf(".")
        ? clean.replace(/\./g, "").replace(",", ".")
        : clean.replace(/,/g, "");
  } else if (hasComma) {
    normalized = clean.replace(",", ".");
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(clean)) {
    normalized = clean.replace(/\./g, "");
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const num = (text: string) => parseAmount(text) ?? 0;

/** Número → texto editable con coma decimal y sin separador de miles. */
export function toInput(value: number): string {
  return round2(value).toFixed(2).replace(".", ",");
}

export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Tipo de cambio contable: 1 para pesos, el informado para moneda extranjera. */
export function fxRate(data: InvoiceData): number {
  const currency = (data.moneda || "ARS").toUpperCase();
  if (currency === "ARS") return 1;
  return data.tipoCambio && data.tipoCambio > 0 ? data.tipoCambio : 1;
}

/** `ES` / `EN` / `PT` a partir del idioma que devuelve el modelo. */
export function languageCode(idioma: string | undefined): string {
  const clean = (idioma ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!clean || clean.startsWith("esp") || clean === "es") return "ES";
  if (clean.startsWith("ing") || clean.startsWith("eng") || clean === "en") return "EN";
  if (clean.startsWith("por") || clean === "pt") return "PT";
  return clean.slice(0, 2).toUpperCase();
}

const OP_BY_RATE: Record<string, string> = {
  "0": "0003",
  "2.5": "0009",
  "5": "0008",
  "10.5": "0004",
  "21": "0005",
  "27": "0006",
};

/** Código de operación: alícuota del Libro IVA Digital, o EXT / exento / no gravado. */
export function opCode(tipo: string, iva: number): string {
  if (tipo === "Exterior") return "EXT";
  if (tipo === "Exento") return "0002";
  if (tipo === "No gravado") return "0001";
  return OP_BY_RATE[String(iva)] ?? "0005";
}

export function regimenFor(exterior: boolean): string {
  return exterior ? "Exterior" : "Libro IVA Digital / F.2002";
}

export function lineCuota(line: GridLine): number {
  return line.tipo === "IVA" ? round2((num(line.base) * num(line.iva)) / 100) : 0;
}

export function gridTotals(grid: GridLine[]) {
  let neto = 0;
  let iva = 0;
  let perc = 0;
  let ret = 0;
  for (const line of grid) {
    neto += num(line.base);
    iva += lineCuota(line);
    perc += num(line.recargo);
    ret += num(line.retencion);
  }
  return {
    neto: round2(neto),
    iva: round2(iva),
    perc: round2(perc),
    ret: round2(ret),
    total: round2(neto + iva + perc),
  };
}

export function newGridLine(exterior: boolean): GridLine {
  return {
    op: exterior ? "EXT" : "0005",
    base: "0,00",
    tipo: exterior ? "Exterior" : "IVA",
    iva: exterior ? "0" : "21",
    recargo: "0,00",
    tipoRet: "",
    retencion: "0,00",
    regimen: regimenFor(exterior),
    contrapartida: "",
  };
}

const sumLines = (lines: TaxLine[]) => round2(lines.reduce((acc, l) => acc + (l.importe || 0), 0));

export function buildGrid(data: InvoiceData): GridLine[] {
  const exterior = data.origen === "exterior";
  const percepciones = sumLines(data.percepciones);
  const retenciones = sumLines(data.retenciones ?? []);
  const retTipo = data.retenciones?.[0]?.tipo ?? "";

  if (data.items.length === 0) {
    return [
      {
        ...newGridLine(exterior),
        base: toInput(data.subtotal || data.total),
        recargo: toInput(percepciones),
        tipoRet: retTipo,
        retencion: toInput(retenciones),
      },
    ];
  }

  return data.items.map((item, index) => {
    const tipo = exterior ? "Exterior" : item.alicuotaIva > 0 ? "IVA" : "Exento";
    return {
      op: opCode(tipo, item.alicuotaIva),
      base: toInput(item.importe),
      tipo,
      iva: String(item.alicuotaIva || 0),
      recargo: toInput(index === 0 ? percepciones : 0),
      tipoRet: index === 0 ? retTipo : "",
      retencion: toInput(index === 0 ? retenciones : 0),
      regimen: regimenFor(exterior),
      contrapartida: item.cuentaContable,
    };
  });
}

export function conceptOf(data: InvoiceData): string {
  const first = data.items[0]?.descripcion;
  if (first) return data.items.length > 1 ? `${first} (+${data.items.length - 1})` : first;
  return data.observaciones;
}

function detectTipo(data: InvoiceData): string {
  if (data.origen === "exterior") return "Exterior";
  const match = /\b(?:factura|nota de (?:cr[eé]dito|d[eé]bito))\s+([abcem])\b/i.exec(
    data.tipoComprobante,
  );
  return match ? `Factura ${match[1].toUpperCase()}` : "Otro";
}

const isoToAr = (iso: string | null) => (iso ? formatDateAR(iso) : "");

export function buildForm(data: InvoiceData, _client?: ClientProfile): RowForm {
  const exterior = data.origen === "exterior";
  const fecha = isoToAr(data.fechaEmision);
  const nro =
    data.puntoDeVenta && data.numero
      ? `${data.puntoDeVenta}-${data.numero}`
      : data.numero || data.puntoDeVenta;

  return {
    tipoCompAfip: detectTipo(data),
    nroFactura: nro,
    fechaFactura: fecha,
    fechaAsiento: fecha,
    fechaOperacion: fecha,
    proveedor: data.emisor.razonSocial,
    cuenta: exterior ? CUENTA_PROVEEDORES_EXTERIOR : CUENTA_PROVEEDORES,
    cuentaTesoreria: "",
    rectificativa: /nota de cr[eé]dito/i.test(data.tipoComprobante),
    moneda: (data.moneda || "ARS").toUpperCase(),
    tipoCambio: data.tipoCambio ? toInput(data.tipoCambio) : "",
    total: toInput(data.total),
    cuit: data.emisor.cuit,
    concepto: conceptOf(data),
    textoIdentif: "",
    tfn1: "",
    tfn2: "",
    ajustes: "",
    observaciones: data.observaciones,
    descripcion: "",
    grid: buildGrid(data),
  };
}

/** Separa `0003-00001234` en punto de venta y número; si no hay guion, todo es número. */
export function parseInvoiceNumber(text: string): { puntoDeVenta: string; numero: string } {
  const match = /^\s*(\d{1,5})\s*-\s*(\d{1,8})\s*$/.exec(text);
  if (match) return { puntoDeVenta: match[1], numero: match[2] };
  return { puntoDeVenta: "", numero: text.trim() };
}

function composeTipo(form: RowForm, original: string): string {
  if (form.tipoCompAfip === "Exterior") {
    return form.rectificativa ? "Nota de crédito exterior" : "Factura exterior";
  }
  if (form.tipoCompAfip === "Otro") return original;
  const letter = form.tipoCompAfip.replace("Factura ", "");
  return form.rectificativa ? `Nota de crédito ${letter}` : `Factura ${letter}`;
}

function rateLabel(rate: number): string {
  return String(rate).replace(".", ",");
}

/** Vuelca la ficha editada sobre el comprobante interpretado. */
export function applyForm(data: InvoiceData, form: RowForm): InvoiceData {
  const { puntoDeVenta, numero } = parseInvoiceNumber(form.nroFactura);
  const origen: InvoiceData["origen"] =
    form.tipoCompAfip === "Exterior"
      ? "exterior"
      : form.tipoCompAfip === "Otro"
        ? data.origen
        : "local";

  const fechaEmision = form.fechaFactura.trim()
    ? (parseDateAR(form.fechaFactura) ?? data.fechaEmision)
    : null;

  const gridChanged = JSON.stringify(form.grid) !== JSON.stringify(buildGrid(data));
  let { items, subtotal, impuestos, percepciones } = data;
  let retenciones = data.retenciones ?? [];

  if (gridChanged) {
    const lines = form.grid.map((line) => ({
      base: num(line.base),
      iva: num(line.iva),
      cuota: lineCuota(line),
      line,
    }));

    items = lines.map(({ base, iva, line }, index) => {
      const original = data.items[index];
      const unchanged = original && round2(original.importe) === round2(base);
      return {
        descripcion: original?.descripcion ?? form.concepto,
        descripcionOriginal: original?.descripcionOriginal ?? "",
        cantidad: original?.cantidad ?? 1,
        unidad: original?.unidad ?? "servicio",
        precioUnitario: unchanged
          ? original.precioUnitario
          : original && original.cantidad > 0
            ? round2(base / original.cantidad)
            : base,
        alicuotaIva: iva,
        importe: base,
        cuentaContable: line.contrapartida,
      };
    });
    subtotal = round2(lines.reduce((acc, l) => acc + l.base, 0));

    const byRate = new Map<number, { base: number; cuota: number }>();
    for (const { base, iva, cuota, line } of lines) {
      if (line.tipo !== "IVA" || iva <= 0) continue;
      const current = byRate.get(iva) ?? { base: 0, cuota: 0 };
      byRate.set(iva, { base: current.base + base, cuota: current.cuota + cuota });
    }
    impuestos = [...byRate.entries()].map(([rate, value]) => ({
      tipo: `IVA ${rateLabel(rate)}%`,
      base: round2(value.base),
      alicuota: rate,
      importe: round2(value.cuota),
    }));

    const percTotal = round2(lines.reduce((acc, l) => acc + num(l.line.recargo), 0));
    if (percTotal !== sumLines(data.percepciones)) {
      percepciones =
        percTotal !== 0
          ? [
              {
                tipo: data.percepciones[0]?.tipo ?? "Percepciones IIBB / IVA",
                base: 0,
                alicuota: data.percepciones[0]?.alicuota ?? 0,
                importe: percTotal,
              },
            ]
          : [];
    }

    const retTotal = round2(lines.reduce((acc, l) => acc + num(l.line.retencion), 0));
    if (retTotal !== sumLines(data.retenciones ?? [])) {
      const label = lines.find((l) => l.line.tipoRet.trim())?.line.tipoRet.trim();
      retenciones =
        retTotal !== 0
          ? [
              {
                tipo: label || data.retenciones?.[0]?.tipo || "Retención",
                base: 0,
                alicuota: 0,
                importe: retTotal,
              },
            ]
          : [];
    }
  }

  if (form.concepto.trim() && form.concepto.trim() !== conceptOf(data) && items[0]) {
    items = items.map((item, index) =>
      index === 0 ? { ...item, descripcion: form.concepto.trim() } : item,
    );
  }

  const cuit = form.cuit.trim();
  return applyProvisionalIds({
    ...data,
    tipoComprobante: composeTipo(form, data.tipoComprobante),
    origen,
    puntoDeVenta,
    numero,
    fechaEmision,
    emisor: {
      ...data.emisor,
      razonSocial: form.proveedor.trim() || data.emisor.razonSocial,
      cuit,
    },
    emisorIdProvisorio: isProvisionalId(cuit),
    moneda: form.moneda || data.moneda,
    tipoCambio: form.moneda === "ARS" ? null : parseAmount(form.tipoCambio),
    total: parseAmount(form.total) ?? data.total,
    items,
    subtotal,
    impuestos,
    percepciones,
    retenciones,
    observaciones: form.observaciones,
  });
}

export function isValidDateAr(value: string): boolean {
  const iso = parseDateAR(value);
  if (!iso) return false;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === iso;
}

/** Errores de formato de la ficha, que impiden marcarla como revisada. */
export function formIssues(form: RowForm): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const dates: Array<[string, string]> = [
    ["Fecha factura", form.fechaFactura],
    ["Fecha asiento", form.fechaAsiento],
    ["Fecha operación", form.fechaOperacion],
  ];
  for (const [label, value] of dates) {
    if (value.trim() && !isValidDateAr(value)) {
      issues.push({
        code: "fecha_formato",
        message: `${label}: formato inválido, usá DD/MM/AAAA.`,
        severity: "error",
      });
    }
  }
  if (parseAmount(form.total) === null) {
    issues.push({
      code: "total_invalido",
      message: "Total Fra.: el importe no es un número válido.",
      severity: "error",
    });
  }
  if (form.moneda !== "ARS" && form.tipoCambio.trim() && parseAmount(form.tipoCambio) === null) {
    issues.push({
      code: "tipo_cambio_invalido",
      message: "T.C.: el tipo de cambio no es un número válido.",
      severity: "error",
    });
  }
  const badGrid = form.grid.some((line) =>
    [line.base, line.recargo, line.retencion, line.iva].some(
      (value) => value.trim() !== "" && parseAmount(value) === null,
    ),
  );
  if (badGrid) {
    issues.push({
      code: "grilla_invalida",
      message: "La grilla de desglose tiene importes que no son números válidos.",
      severity: "error",
    });
  }
  return issues;
}
