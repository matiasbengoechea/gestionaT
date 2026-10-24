/**
 * Verificación de la lógica contable sin depender de la API de IA.
 *
 * Uso:
 *   node node_modules/typescript/bin/tsc scripts/verify.ts \
 *     --outDir /tmp/gestionat-verify --module commonjs --target es2022 \
 *     --moduleResolution node --esModuleInterop --skipLibCheck
 *   node /tmp/gestionat-verify/scripts/verify.js
 */

import { isValidCuit, normalizeCuit } from "../lib/cuit";
import { CLIENTS } from "../lib/clients";
import { DEMO_ROWS } from "../lib/demo-rows";
import { trafficLight } from "../lib/ui-mapping";
import { normalizeInvoice, toISODate, toNumber } from "../lib/ai/normalize";
import { documentKind, mimeForDocument } from "../lib/file-kind";
import { escapeHtml, htmlToText } from "../lib/html";
import { invoiceKey, validateInvoice } from "../lib/validate";
import type { InvoiceData } from "../lib/types";

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`, detail ?? "");
  }
}

function codes(
  data: InvoiceData,
  knownKeys: string[] = [],
  client = CLIENTS[0],
) {
  return validateInvoice(data, client, knownKeys).map((issue) => issue.code);
}

console.log("\nCUIT");
check("CUIT del estudio es válido", isValidCuit(CLIENTS[0].cuit), CLIENTS[0].cuit);
check("CUIT de la metalúrgica es válido", isValidCuit(CLIENTS[1].cuit), CLIENTS[1].cuit);
check("CUIT de la bodega es válido", isValidCuit(CLIENTS[2].cuit), CLIENTS[2].cuit);
check("CUIT con dígito incorrecto es inválido", !isValidCuit("30-71234567-9"));
check("CUIT con guiones se normaliza", normalizeCuit("30-71234567-1") === "30712345671");

console.log("\nParseo de números");
check('"1.234,56" -> 1234.56', toNumber("1.234,56") === 1234.56, toNumber("1.234,56"));
check('"1,234.56" -> 1234.56', toNumber("1,234.56") === 1234.56, toNumber("1,234.56"));
check('"$ 21.000" -> 21000', toNumber("$ 21.000") === 21000, toNumber("$ 21.000"));
check('"1210" -> 1210', toNumber("1210") === 1210);
check("número nativo se respeta", toNumber(99.5) === 99.5);

console.log("\nParseo de fechas");
check('"15/03/2025" -> 2025-03-15', toISODate("15/03/2025") === "2025-03-15");
check('"2025-3-5" -> 2025-03-05', toISODate("2025-3-5") === "2025-03-05");
check('"05-03-25" -> 2025-03-05', toISODate("05-03-25") === "2025-03-05");
check("texto inválido -> null", toISODate("sin fecha") === null);

console.log("\nHTML de facturas");
const html = `<!doctype html><html><head><style>.x{color:red}</style><script>alert(1)</script></head><body><h1>Factura A</h1><p>Total: $1.234,56</p><table><tr><td>IVA</td><td>21%</td></tr></table><img alt="sello" src="sello.png"></body></html>`;
const htmlText = htmlToText(html);
check("quita scripts y estilos", !htmlText.includes("alert") && !htmlText.includes("color:red"), htmlText);
check("conserva el texto visible", htmlText.includes("Factura A") && htmlText.includes("1.234,56"), htmlText);
check("separa celdas de la tabla", htmlText.includes("IVA") && htmlText.includes("21%"), htmlText);
check("conserva el alt de las imágenes", htmlText.includes("sello"), htmlText);
check("decodifica entidades", htmlToText("A &amp; B &nbsp; C") === "A & B C", htmlToText("A &amp; B &nbsp; C"));
check("HTML sin texto devuelve vacío", htmlToText("<img src='x.png'>") === "", htmlToText("<img src='x.png'>"));
check("escapa texto para el visor", escapeHtml("<b>A & B</b>") === "&lt;b&gt;A &amp; B&lt;/b&gt;");
check("detecta HTML por extensión", documentKind("factura.HTML", "") === "html");
check("detecta HTML por MIME", documentKind("adjunto", "text/html") === "html");
check("detecta TXT", documentKind("factura.txt", "application/octet-stream") === "text");
check("rechaza binarios", documentKind("virus.exe", "application/octet-stream") === null);
check("MIME confiable para HTML", mimeForDocument("html", "x", "application/octet-stream") === "text/html");

console.log("\nNormalización de una extracción cruda");
const raw = {
  tipoComprobante: "Factura A",
  puntoDeVenta: "0003",
  numero: "00001234",
  fechaEmision: "15/03/2025",
  fechaVencimiento: null,
  emisor: {
    razonSocial: "Aceros del Sur S.A.",
    cuit: "30-71234567-1",
    condicionIva: "Responsable Inscripto",
    domicilio: "Av. Industrial 500",
  },
  receptor: {
    razonSocial: "Metalúrgica Aconcagua S.A.",
    cuit: "30-71456789-2",
    condicionIva: "Responsable Inscripto",
    domicilio: "Parque Industrial",
  },
  moneda: "usd",
  tipoCambio: "1.050,50",
  items: [
    {
      descripcion: "Bobina de acero laminada en caliente",
      descripcionOriginal: "Hot rolled steel coil",
      cantidad: "2",
      unidad: "tn",
      precioUnitario: "1.234,56",
      alicuotaIva: "21",
      importe: "2.469,12",
      cuentaContable: "1.1.4.10",
    },
  ],
  subtotal: "2.469,12",
  impuestos: [{ tipo: "IVA 21%", base: "2.469,12", alicuota: "21", importe: "518,52" }],
  percepciones: [],
  total: "2.987,64",
  cae: "74123456789012",
  caeVencimiento: "25/03/2025",
  idiomaOriginal: "inglés",
  observaciones: "",
  camposDudosos: [],
  confianza: "0,94",
};

const invoice = normalizeInvoice(raw);
check("moneda en mayúsculas", invoice.moneda === "USD", invoice.moneda);
check("tipo de cambio parseado", invoice.tipoCambio === 1050.5, invoice.tipoCambio);
check("fecha ISO", invoice.fechaEmision === "2025-03-15", invoice.fechaEmision);
check("importe del ítem", invoice.items[0].importe === 2469.12, invoice.items[0].importe);
check("confianza acotada", invoice.confianza === 0.94, invoice.confianza);
check("traducción conserva original", invoice.items[0].descripcionOriginal === "Hot rolled steel coil");

console.log("\nValidación de una factura consistente");
const cleanCodes = codes(invoice, [], CLIENTS[1]);
check("sin errores ni advertencias", cleanCodes.length === 0, cleanCodes);

console.log("\nValidación de una factura inconsistente");
const broken: InvoiceData = {
  ...invoice,
  emisor: { ...invoice.emisor, cuit: "30-71234567-9" },
  total: 9999,
  cae: null,
  fechaEmision: "2025-03-15",
  camposDudosos: ["numero"],
  confianza: 0.4,
};
const brokenCodes = codes(broken);
check("detecta CUIT inválido", brokenCodes.includes("cuit_emisor_invalido"), brokenCodes);
check("detecta total inconsistente", brokenCodes.includes("total_no_coincide"), brokenCodes);
check("detecta CAE faltante", brokenCodes.includes("cae_faltante"), brokenCodes);
check("detecta campos dudosos", brokenCodes.includes("campo_dudoso"), brokenCodes);
check("detecta confianza baja", brokenCodes.includes("confianza_baja"), brokenCodes);

console.log("\nDetección de duplicados");
const key = invoiceKey(invoice);
check("misma clave con distinto formato de CUIT", key === invoiceKey({ ...invoice, emisor: { ...invoice.emisor, cuit: "30712345671" } }));
check("duplicado detectado", codes(invoice, [key]).includes("comprobante_duplicado"));

console.log("\nFacturas del exterior");
const exterior = normalizeInvoice({
  ...raw,
  tipoComprobante: "Factura exterior",
  origen: "exterior",
  emisor: {
    razonSocial: "Systemsx Ltd",
    cuit: "GB123456789",
    condicionIva: "Exterior",
    domicilio: "12 King Street, London",
  },
  cae: null,
  moneda: "GBP",
  tipoCambio: "1.250,50",
});
const exteriorCodes = codes(exterior, [], CLIENTS[1]);
check(
  "no exige CUIT ni CAE",
  !exteriorCodes.includes("cuit_emisor_invalido") &&
    !exteriorCodes.includes("cae_faltante"),
  exteriorCodes,
);
check("marca el comprobante como exterior", exteriorCodes.includes("comprobante_exterior"), exteriorCodes);
check(
  "no reporta errores bloqueantes",
  !exteriorCodes.includes("total_no_coincide"),
  exteriorCodes,
);

const inferred = normalizeInvoice({
  ...raw,
  emisor: { ...raw.emisor, cuit: "GB123456789" },
});
check("infiere exterior sin origen explícito", inferred.origen === "exterior", inferred.origen);

console.log("\nReceptor distinto al cliente");
const otherClient = codes(invoice);
check(
  "avisa cuando el receptor no es el cliente seleccionado",
  otherClient.includes("receptor_distinto_al_cliente"),
  otherClient,
);

console.log("\nLote de demostración");
check("tiene 6 filas", DEMO_ROWS.length === 6, DEMO_ROWS.length);
const lights = DEMO_ROWS.map(trafficLight);
check("5 verdes", lights.filter((light) => light === "green").length === 5, lights);
check("1 ámbar", lights.filter((light) => light === "amber").length === 1, lights);
check("ninguna roja", lights.filter((light) => light === "red").length === 0, lights);

console.log(
  failures === 0
    ? "\nTodo OK\n"
    : `\n${failures} verificación(es) fallaron\n`,
);

process.exit(failures === 0 ? 0 : 1);
