import type { InvoiceData, Party, ValidationIssue } from "./types";

const PROVISIONAL_PREFIX = "CUIT-PROV-";

export function isProvisionalId(value: string | null | undefined): boolean {
  return (value ?? "").startsWith(PROVISIONAL_PREFIX);
}

function hashDigits(text: string): string {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 10000;
  }
  return String(hash).padStart(4, "0");
}

/**
 * Identificador fiscal provisorio basado en las iniciales de la razón social
 * (ej. "Osborne Waine" → CUIT-PROV-OSBO-9921). Es determinístico: el mismo
 * nombre siempre produce el mismo código, así las facturas del mismo tercero
 * se agrupan hasta que el administrativo cargue el CUIT/NIF real.
 */
export function buildProvisionalId(razonSocial: string): string {
  const letters = razonSocial
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  const initials = (letters.slice(0, 4) || "XXXX").padEnd(4, "X");
  return `${PROVISIONAL_PREFIX}${initials}-${hashDigits(razonSocial.trim().toLowerCase())}`;
}

function withProvisionalId(party: Party): { party: Party; generated: boolean } {
  if (party.cuit.trim()) return { party, generated: false };
  return {
    party: { ...party, cuit: buildProvisionalId(party.razonSocial || "Sin nombre") },
    generated: true,
  };
}

/** Completa el CUIT/NIF faltante del emisor y del receptor con un identificador provisorio. */
export function applyProvisionalIds(data: InvoiceData): InvoiceData {
  const emisor = withProvisionalId(data.emisor);
  const receptor = withProvisionalId(data.receptor);

  return {
    ...data,
    emisor: emisor.party,
    receptor: receptor.party,
    emisorIdProvisorio: emisor.generated || data.emisorIdProvisorio || false,
    receptorIdProvisorio: receptor.generated || data.receptorIdProvisorio || false,
  };
}

export function provisionalIdIssues(data: InvoiceData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (data.emisorIdProvisorio) {
    issues.push({
      code: "id_fiscal_provisorio_emisor",
      message: `Emisor sin CUIT/NIF fiscal: se generó el identificador provisorio ${data.emisor.cuit} basado en su nombre.`,
      severity: "warning",
    });
  }

  if (data.receptorIdProvisorio) {
    issues.push({
      code: "id_fiscal_provisorio_receptor",
      message: `Receptor sin CUIT/NIF fiscal: se generó el identificador provisorio ${data.receptor.cuit} basado en su nombre.`,
      severity: "warning",
    });
  }

  return issues;
}
