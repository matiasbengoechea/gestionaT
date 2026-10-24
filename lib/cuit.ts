/** Utilidades de CUIT/CUIL (Argentina). */

export function normalizeCuit(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Valida un CUIT con el dígito verificador (módulo 11).
 * Acepta el valor con o sin guiones.
 */
export function isValidCuit(value: string | null | undefined): boolean {
  const digits = normalizeCuit(value);
  if (digits.length !== 11) return false;

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += Number(digits[i]) * weights[i];
  }

  const mod = sum % 11;
  const check = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod;
  return check === Number(digits[10]);
}

export function formatCuit(value: string | null | undefined): string {
  const digits = normalizeCuit(value);
  if (digits.length !== 11) return value ?? "";
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}
