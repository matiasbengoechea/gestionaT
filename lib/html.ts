/**
 * Conversión de HTML a texto plano para mandar al modelo.
 *
 * No renderiza: extrae el texto visible. Sirve para facturas HTML que traen
 * los datos como texto (lo habitual en comprobantes electrónicos por mail).
 * Si la factura está embebida como imagen, el HTML no alcanza y hay que subir
 * el PDF o la imagen.
 */

/** Tope de caracteres para no reventar el contexto del modelo. */
const MAX_TEXT = 120_000;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  euro: "€",
  pound: "£",
  dollar: "$",
  deg: "°",
  ordm: "º",
  ordf: "ª",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  middot: "·",
  times: "×",
  divide: "÷",
  plusmn: "±",
  reg: "®",
  copy: "©",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[entity] ?? match;
  });
}

export function htmlToText(html: string): string {
  let value = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    // El contenido de estos bloques no es texto visible.
    .replace(/<(script|style|head|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    // El alt de una imagen puede traer datos (por ejemplo, un sello o un total).
    .replace(/<img\b[^>]*\balt\s*=\s*("([^"]*)"|'([^']*)')[^>]*>/gi, (_match, _raw, double, single) => {
      return ` ${double ?? single ?? ""} `;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|header|footer|blockquote)>/gi, "\n")
    .replace(/<\/(td|th)>/gi, "\t")
    .replace(/<[^>]+>/g, " ");

  value = decodeEntities(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}\n\n[texto truncado]` : value;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Heurística para cuerpos de mail que llegan sin `Content-Type` útil. */
export function looksLikeHtml(value: string): boolean {
  return /<\s*(html|body|table|div|p|span|br|tr|td)\b/i.test(value);
}
