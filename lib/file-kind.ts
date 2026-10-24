/**
 * Clasificación de archivos de factura por MIME y extensión.
 *
 * Algunos clientes de mail mandan `application/octet-stream` o un MIME vacío
 * para adjuntos `.html`, así que la extensión manda cuando el MIME no alcanza.
 */

export type DocumentKind = "pdf" | "image" | "html" | "text";

const IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const HTML_MIME = new Set(["text/html", "application/xhtml+xml"]);

export function documentKind(fileName: string, mimeType: string): DocumentKind | null {
  const name = fileName.toLowerCase();
  const type = mimeType.toLowerCase().trim();

  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (IMAGE_MIME.has(type) || /\.(png|jpe?g|webp)$/.test(name)) return "image";
  if (HTML_MIME.has(type) || /\.(html?|xhtml)$/.test(name)) return "html";
  if (type === "text/plain" || name.endsWith(".txt")) return "text";

  return null;
}

/** MIME confiable para mandar al modelo o guardar en Storage. */
export function mimeForDocument(
  kind: DocumentKind,
  fileName: string,
  provided = "",
): string {
  if (kind === "pdf") return "application/pdf";
  if (kind === "html") return "text/html";
  if (kind === "text") return "text/plain";
  if (IMAGE_MIME.has(provided)) return provided;

  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  return "image/png";
}
