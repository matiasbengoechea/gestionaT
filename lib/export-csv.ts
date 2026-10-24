import type { InvoiceRow } from "./use-invoice-queue";
import { sumTaxes } from "./validate";

const HEADER = [
  "tipo_fila",
  "archivo",
  "tipo_comprobante",
  "punto_venta",
  "numero",
  "fecha_emision",
  "emisor",
  "cuit_emisor",
  "receptor",
  "cuit_receptor",
  "moneda",
  "cotizacion",
  "subtotal",
  "iva",
  "percepciones",
  "total",
  "cae",
  "descripcion",
  "cantidad",
  "precio_unitario",
  "alicuota_iva",
  "importe_item",
  "cuenta_contable",
];

function escapeCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/**
 * Exporta cabecera y detalle en un solo CSV.
 *
 * Los sistemas contables legacy importan una fila por renglón, no una por
 * factura. `tipo_fila` distingue `C` (cabecera) de `D` (detalle).
 */
export function buildCsv(rows: InvoiceRow[]): string {
  const approved = rows.filter((row) => row.approved && row.data);
  const lines: Array<Array<string | number>> = [HEADER];

  for (const row of approved) {
    const data = row.data!;
    const header: Array<string | number> = [
      "C",
      row.fileName,
      data.tipoComprobante,
      data.puntoDeVenta,
      data.numero,
      data.fechaEmision ?? "",
      data.emisor.razonSocial,
      data.emisor.cuit,
      data.receptor.razonSocial,
      data.receptor.cuit,
      data.moneda,
      data.tipoCambio ?? "",
      data.subtotal.toFixed(2),
      sumTaxes(data.impuestos).toFixed(2),
      sumTaxes(data.percepciones).toFixed(2),
      data.total.toFixed(2),
      data.cae ?? "",
      "",
      "",
      "",
      "",
      "",
      "",
    ];
    lines.push(header);

    for (const item of data.items) {
      lines.push([
        "D",
        row.fileName,
        data.tipoComprobante,
        data.puntoDeVenta,
        data.numero,
        data.fechaEmision ?? "",
        data.emisor.razonSocial,
        data.emisor.cuit,
        data.receptor.razonSocial,
        data.receptor.cuit,
        data.moneda,
        data.tipoCambio ?? "",
        "",
        "",
        "",
        "",
        "",
        item.descripcion,
        item.cantidad,
        item.precioUnitario.toFixed(2),
        item.alicuotaIva,
        item.importe.toFixed(2),
        item.cuentaContable,
      ]);
    }
  }

  return lines.map((line) => line.map(escapeCell).join(",")).join("\r\n");
}

export function downloadCsv(rows: InvoiceRow[]) {
  const csv = buildCsv(rows);
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gestionat-facturas-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
