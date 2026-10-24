import type { ClientProfile } from "./clients";
import type { InvoiceRow } from "./use-invoice-queue";

export type TrafficLight = "green" | "amber" | "red";

/** Semáforo de la factura, derivado de los avisos del motor. */
export function trafficLight(row: InvoiceRow): TrafficLight {
  if (row.status === "error") return "red";
  if (row.status !== "done" || !row.data) return "amber";
  if (row.issues.some((issue) => issue.severity === "error")) return "red";
  if (row.issues.some((issue) => issue.severity === "warning")) return "amber";
  if (row.data.confianza < 0.75) return "amber";
  return "green";
}

export function statusLabel(row: InvoiceRow): string {
  if (row.status === "pending") return "En cola";
  if (row.status === "processing") return "Leyendo…";
  if (row.status === "error") return "Error";
  if (row.approved) return "Aprobada";
  const light = trafficLight(row);
  if (light === "red") return "Revisar";
  if (light === "amber") return "Revisar";
  return "Lista";
}

/** `2026-07-01` → `01/07/2026`. */
export function formatDateAR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

/** `01/07/2026` → `2026-07-01`, para los `<input type="date">`. */
export function parseDateAR(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function rowCompany(row: InvoiceRow, client: ClientProfile | undefined): string {
  return client?.nombre ?? "—";
}

export function rowActivity(row: InvoiceRow, client: ClientProfile | undefined): string {
  return client?.rubro ?? "—";
}

export function rowYear(row: InvoiceRow): string {
  return row.data?.fechaEmision?.slice(0, 4) ?? "—";
}

export function rowDate(row: InvoiceRow): string {
  return formatDateAR(row.data?.fechaEmision);
}

export function rowNumber(row: InvoiceRow): string {
  if (!row.data) return "—";
  const { puntoDeVenta, numero } = row.data;
  if (puntoDeVenta && numero) return `${puntoDeVenta}-${numero}`;
  return numero || puntoDeVenta || "—";
}

export function rowSupplier(row: InvoiceRow): string {
  return row.data?.emisor.razonSocial || row.fileName;
}

export function rowCuit(row: InvoiceRow): string {
  return row.data?.emisor.cuit || "—";
}

export function rowConcept(row: InvoiceRow): string {
  if (!row.data) return "";
  const first = row.data.items[0]?.descripcion;
  if (first) {
    return row.data.items.length > 1 ? `${first} (+${row.data.items.length - 1})` : first;
  }
  return row.data.observaciones;
}

export function rowCurrency(row: InvoiceRow): string {
  return row.data?.moneda ?? "ARS";
}
