import type { InvoiceData } from "../types";
import { invoiceKey, round2, sumTaxes } from "../validate";

/**
 * Modelo canónico de salida.
 *
 * Es independiente del formato de destino: los adaptadores (CSV, Tango, API)
 * consumen esto, no el modelo de extracción.
 */

export interface OutputLine {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  alicuotaIva: number;
  importe: number;
  cuentaContable: string;
}

export interface OutputInvoice {
  key: string;
  tipoComprobante: string;
  puntoDeVenta: string;
  numero: string;
  fechaEmision: string | null;
  emisor: { razonSocial: string; idFiscal: string; condicionIva: string };
  receptor: { razonSocial: string; idFiscal: string };
  moneda: string;
  tipoCambio: number | null;
  tipoCambioFuente: string | null;
  tipoCambioFecha: string | null;
  baseImponibleArs: number;
  impuestosArs: number;
  totalArs: number;
  cae: string | null;
  origen: "local" | "exterior";
  lineas: OutputLine[];
}

export interface OutputBatch {
  id: string;
  creadoEn: string;
  clienteId: string;
  facturas: OutputInvoice[];
  metricas: { facturas: number; renglones: number; totalArs: number };
}

function rate(data: InvoiceData): number {
  return data.moneda !== "ARS" && data.tipoCambio ? data.tipoCambio : 1;
}

export function buildBatch(invoices: InvoiceData[], clienteId: string): OutputBatch {
  const facturas: OutputInvoice[] = invoices.map((data) => {
    const fx = rate(data);
    return {
      key: invoiceKey(data),
      tipoComprobante: data.tipoComprobante,
      puntoDeVenta: data.puntoDeVenta,
      numero: data.numero,
      fechaEmision: data.fechaEmision,
      emisor: {
        razonSocial: data.emisor.razonSocial,
        idFiscal: data.emisor.cuit,
        condicionIva: data.emisor.condicionIva,
      },
      receptor: {
        razonSocial: data.receptor.razonSocial,
        idFiscal: data.receptor.cuit,
      },
      moneda: data.moneda,
      tipoCambio: data.tipoCambio,
      tipoCambioFuente: data.tipoCambioFuente ?? null,
      tipoCambioFecha: data.tipoCambioFecha ?? null,
      baseImponibleArs: round2(data.subtotal * fx),
      impuestosArs: round2((sumTaxes(data.impuestos) + sumTaxes(data.percepciones)) * fx),
      totalArs: round2(data.total * fx),
      cae: data.cae,
      origen: data.origen,
      lineas: data.items.map((item) => ({
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        alicuotaIva: item.alicuotaIva,
        importe: item.importe,
        cuentaContable: item.cuentaContable,
      })),
    };
  });

  return {
    id: `lote-${Date.now().toString(36)}`,
    creadoEn: new Date().toISOString(),
    clienteId,
    facturas,
    metricas: {
      facturas: facturas.length,
      renglones: facturas.reduce((acc, factura) => acc + factura.lineas.length, 0),
      totalArs: round2(facturas.reduce((acc, factura) => acc + factura.totalArs, 0)),
    },
  };
}

const HEADER = [
  "tipo_fila",
  "lote",
  "tipo_comprobante",
  "punto_venta",
  "numero",
  "fecha_emision",
  "emisor",
  "id_fiscal_emisor",
  "receptor",
  "id_fiscal_receptor",
  "moneda",
  "cotizacion",
  "base_imponible_ars",
  "impuestos_ars",
  "total_ars",
  "cae",
  "descripcion",
  "cantidad",
  "precio_unitario",
  "alicuota_iva",
  "importe_item",
  "cuenta_contable",
];

function cell(value: string | number | null): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/**
 * Adaptador genérico: cabecera (`C`) y detalle (`D`) en un solo CSV.
 * Es el formato que casi cualquier importador contable sabe leer.
 */
export function batchToCsv(batch: OutputBatch): string {
  const rows: Array<Array<string | number | null>> = [HEADER];

  for (const factura of batch.facturas) {
    const base = [
      factura.tipoComprobante,
      factura.puntoDeVenta,
      factura.numero,
      factura.fechaEmision ?? "",
      factura.emisor.razonSocial,
      factura.emisor.idFiscal,
      factura.receptor.razonSocial,
      factura.receptor.idFiscal,
      factura.moneda,
      factura.tipoCambio ?? "",
      factura.baseImponibleArs.toFixed(2),
      factura.impuestosArs.toFixed(2),
      factura.totalArs.toFixed(2),
      factura.cae ?? "",
    ];

    rows.push(["C", batch.id, ...base, "", "", "", "", "", ""]);

    for (const linea of factura.lineas) {
      rows.push([
        "D",
        batch.id,
        ...base.slice(0, 14),
        linea.descripcion,
        linea.cantidad,
        linea.precioUnitario.toFixed(2),
        linea.alicuotaIva,
        linea.importe.toFixed(2),
        linea.cuentaContable,
      ]);
    }
  }

  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
