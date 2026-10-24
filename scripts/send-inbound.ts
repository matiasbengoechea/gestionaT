/**
 * Simula un mail entrante con un adjunto para probar la ingesta y la vista en vivo.
 *
 * Uso:
 *   pnpm inbound samples/factura-a-aceros.pdf
 *   pnpm inbound samples/factura-a-aceros.pdf --from proveedor@ejemplo.com
 *
 * Requiere el servidor corriendo (`pnpm dev`). Si `INBOUND_SECRET` está en
 * `.env.local`, lo usa automáticamente.
 */

import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) {
    console.error(
      "Uso: pnpm inbound <archivo.pdf> [--from remitente@ejemplo.com] [--subject asunto] [--url http://localhost:3000]",
    );
    process.exit(1);
  }

  const base = arg("url", "http://localhost:3000").replace(/\/$/, "");
  const from = arg("from", "proveedor@ejemplo.com");
  const subject = arg("subject", `Factura ${basename(file)}`);
  const secret = (process.env.INBOUND_SECRET ?? "").trim();

  const content = readFileSync(file);
  const mimeType = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";

  const url = new URL(`${base}/api/inbound/email`);
  if (secret) url.searchParams.set("secret", secret);

  console.log(`→ ${file} (${(content.length / 1024).toFixed(0)} KB) desde ${from}`);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      subject,
      attachments: [
        {
          filename: basename(file),
          contentType: mimeType,
          contentBase64: content.toString("base64"),
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`✗ HTTP ${response.status}`, payload ?? "");
    process.exit(1);
  }

  console.log("✓ Mail procesado:", JSON.stringify(payload, null, 2));
  console.log("Mirá la pantalla: la factura aparece en vivo en la tabla.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
