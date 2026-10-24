/**
 * Genera facturas ficticias en `samples/` para probar el motor sin datos reales.
 *
 * Uso: pnpm samples
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const OUT_DIR = "samples";
const BLACK = rgb(0.1, 0.1, 0.1);
const GRAY = rgb(0.45, 0.45, 0.45);
const LIGHT = rgb(0.93, 0.93, 0.93);

interface Ctx {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
}

function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  size = 10,
  bold = false,
  color = BLACK,
) {
  ctx.page.drawText(value, {
    x,
    y,
    size,
    font: bold ? ctx.bold : ctx.font,
    color,
  });
}

function right(ctx: Ctx, value: string, xRight: number, y: number, size = 10, bold = false) {
  const font = bold ? ctx.bold : ctx.font;
  const width = font.widthOfTextAtSize(value, size);
  text(ctx, value, xRight - width, y, size, bold);
}

async function newPage(): Promise<{ pdf: PDFDocument; ctx: Ctx }> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  return { pdf, ctx: { page, font, bold } };
}

function tableHeader(ctx: Ctx, y: number, columns: Array<{ label: string; x: number; right?: number }>) {
  ctx.page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 18, color: LIGHT });
  for (const column of columns) {
    if (column.right !== undefined) {
      right(ctx, column.label, column.right, y, 9, true);
    } else {
      text(ctx, column.label, column.x, y, 9, true);
    }
  }
}

async function facturaA() {
  const { pdf, ctx } = await newPage();

  text(ctx, "ACEROS DEL SUR S.A.", 40, 790, 16, true);
  text(ctx, "Av. Industrial 500 - Rosario, Santa Fe", 40, 774, 9, false, GRAY);
  text(ctx, "CUIT: 30-71234567-1", 40, 761, 9);
  text(ctx, "IVA Responsable Inscripto", 40, 748, 9);

  ctx.page.drawRectangle({ x: 400, y: 735, width: 155, height: 70, borderColor: BLACK, borderWidth: 1.5 });
  text(ctx, "FACTURA", 415, 780, 18, true);
  text(ctx, "A", 520, 780, 22, true);
  text(ctx, "Nº 0003-00001234", 415, 760, 10, true);
  text(ctx, "Fecha: 15/09/2026", 415, 746, 9);

  ctx.page.drawRectangle({ x: 40, y: 660, width: 515, height: 55, borderColor: GRAY, borderWidth: 0.8 });
  text(ctx, "SEÑOR(ES): METALÚRGICA ACONCAGUA S.A.", 50, 697, 9, true);
  text(ctx, "CUIT: 30-71456789-2", 50, 683, 9);
  text(ctx, "Domicilio: Parque Industrial, San Nicolás, Buenos Aires", 50, 669, 9);
  text(ctx, "Condición IVA: Responsable Inscripto", 330, 683, 9);

  tableHeader(ctx, 630, [
    { label: "Descripción", x: 46 },
    { label: "Cant.", x: 330, right: 380 },
    { label: "P. unit.", x: 390, right: 450 },
    { label: "IVA", x: 460, right: 490 },
    { label: "Importe", x: 500, right: 548 },
  ]);

  text(ctx, "Bobina de acero laminada en caliente", 46, 605, 9);
  right(ctx, "2 tn", 380, 605, 9);
  right(ctx, "1.234,56", 450, 605, 9);
  right(ctx, "21%", 490, 605, 9);
  right(ctx, "2.469,12", 548, 605, 9);

  ctx.page.drawLine({ start: { x: 40, y: 590 }, end: { x: 555, y: 590 }, thickness: 0.8, color: GRAY });

  right(ctx, "Subtotal:", 460, 560, 9);
  right(ctx, "2.469,12", 548, 560, 9);
  right(ctx, "IVA 21%:", 460, 546, 9);
  right(ctx, "518,52", 548, 546, 9);
  right(ctx, "Total:", 460, 528, 11, true);
  right(ctx, "2.987,64", 548, 528, 11, true);

  text(ctx, "Vencimiento: 15/10/2026", 40, 528, 9);
  text(ctx, "Condición de pago: cuenta corriente 30 días", 40, 514, 9, false, GRAY);

  ctx.page.drawLine({ start: { x: 40, y: 120 }, end: { x: 555, y: 120 }, thickness: 0.8, color: GRAY });
  text(ctx, "CAE Nº: 74123456789012", 40, 100, 9, true);
  text(ctx, "Fecha de Vto. de CAE: 25/09/2026", 40, 86, 9);
  text(ctx, "Comprobante Autorizado - ORIGINAL", 40, 72, 8, false, GRAY);

  return pdf.save();
}

async function facturaExteriorSystemsx() {
  const { pdf, ctx } = await newPage();

  text(ctx, "SYSTEMSX LTD", 40, 790, 16, true);
  text(ctx, "12 King Street, London, United Kingdom", 40, 774, 9, false, GRAY);
  text(ctx, "VAT Registration No: GB123456789", 40, 761, 9);

  text(ctx, "INVOICE", 430, 790, 20, true);
  text(ctx, "Ref. 024/2026", 430, 768, 10, true);
  text(ctx, "Date: 01/07/2026", 430, 754, 9);

  ctx.page.drawRectangle({ x: 40, y: 670, width: 515, height: 60, borderColor: GRAY, borderWidth: 0.8 });
  text(ctx, "BILL TO", 50, 712, 9, true);
  text(ctx, "METALURGICA ACONCAGUA S.A.", 50, 697, 10, true);
  text(ctx, "CUIT: 30-71456789-2", 50, 683, 9);
  text(ctx, "Parque Industrial, San Nicolas, Buenos Aires, Argentina", 50, 669, 9);

  tableHeader(ctx, 630, [
    { label: "Description", x: 46 },
    { label: "Qty", x: 330, right: 380 },
    { label: "Unit price", x: 390, right: 450 },
    { label: "Amount", x: 500, right: 548 },
  ]);

  text(ctx, "Professional services", 46, 605, 9);
  right(ctx, "1", 380, 605, 9);
  right(ctx, "3,500.00", 450, 605, 9);
  right(ctx, "3,500.00", 548, 605, 9);

  ctx.page.drawLine({ start: { x: 40, y: 590 }, end: { x: 555, y: 590 }, thickness: 0.8, color: GRAY });

  right(ctx, "TOTAL GBP", 460, 560, 11, true);
  right(ctx, "3,500.00", 548, 560, 11, true);

  text(ctx, "Payment terms: 30 days net", 40, 540, 9, false, GRAY);
  text(ctx, "Exchange rate applied: 1 GBP = 1,250.50 ARS", 40, 526, 9, false, GRAY);

  return pdf.save();
}

async function facturaExteriorProtectec() {
  const { pdf, ctx } = await newPage();

  text(ctx, "PROTECTEC GmbH", 40, 790, 16, true);
  text(ctx, "Industriestraße 8, 80331 München, Deutschland", 40, 774, 9, false, GRAY);
  text(ctx, "USt-IdNr.: DE811234567", 40, 761, 9);

  text(ctx, "RECHNUNG", 430, 790, 18, true);
  text(ctx, "Nr. 031/2026", 430, 768, 10, true);
  text(ctx, "Datum: 01.08.2026", 430, 754, 9);

  ctx.page.drawRectangle({ x: 40, y: 670, width: 515, height: 60, borderColor: GRAY, borderWidth: 0.8 });
  text(ctx, "RECHNUNGSEMPFÄNGER", 50, 712, 9, true);
  text(ctx, "METALURGICA ACONCAGUA S.A.", 50, 697, 10, true);
  text(ctx, "CUIT: 30-71456789-2", 50, 683, 9);
  text(ctx, "Parque Industrial, San Nicolas, Buenos Aires, Argentinien", 50, 669, 9);

  tableHeader(ctx, 630, [
    { label: "Beschreibung", x: 46 },
    { label: "Menge", x: 330, right: 380 },
    { label: "Einzelpreis", x: 390, right: 450 },
    { label: "Betrag", x: 500, right: 548 },
  ]);

  text(ctx, "Technical maintenance services", 46, 605, 9);
  right(ctx, "1", 380, 605, 9);
  right(ctx, "1.250,00", 450, 605, 9);
  right(ctx, "1.250,00", 548, 605, 9);

  ctx.page.drawLine({ start: { x: 40, y: 590 }, end: { x: 555, y: 590 }, thickness: 0.8, color: GRAY });

  right(ctx, "GESAMT EUR", 460, 560, 11, true);
  right(ctx, "1.250,00", 548, 560, 11, true);

  text(ctx, "Zahlungsziel: 30 Tage netto", 40, 540, 9, false, GRAY);
  text(ctx, "Wechselkurs: 1 EUR = 1.480,20 ARS", 40, 526, 9, false, GRAY);

  return pdf.save();
}

async function facturaCSinCae() {
  const { pdf, ctx } = await newPage();

  text(ctx, "SERVICIOS DEL PLATA", 40, 790, 16, true);
  text(ctx, "Calle 50 Nº 720 - La Plata, Buenos Aires", 40, 774, 9, false, GRAY);
  text(ctx, "CUIT: 27-12345678-0", 40, 761, 9);
  text(ctx, "IVA Responsable Inscripto", 40, 748, 9);

  ctx.page.drawRectangle({ x: 400, y: 735, width: 155, height: 70, borderColor: BLACK, borderWidth: 1.5 });
  text(ctx, "FACTURA", 415, 780, 18, true);
  text(ctx, "C", 520, 780, 22, true);
  text(ctx, "Nº 0005-00000042", 415, 760, 10, true);
  text(ctx, "Fecha: 20/09/2026", 415, 746, 9);

  ctx.page.drawRectangle({ x: 40, y: 660, width: 515, height: 55, borderColor: GRAY, borderWidth: 0.8 });
  text(ctx, "SEÑOR(ES): METALÚRGICA ACONCAGUA S.A.", 50, 697, 9, true);
  text(ctx, "CUIT: 30-71456789-2", 50, 683, 9);
  text(ctx, "Domicilio: Parque Industrial, San Nicolás, Buenos Aires", 50, 669, 9);

  tableHeader(ctx, 630, [
    { label: "Descripción", x: 46 },
    { label: "Cant.", x: 330, right: 380 },
    { label: "P. unit.", x: 390, right: 450 },
    { label: "Importe", x: 500, right: 548 },
  ]);

  text(ctx, "Servicio de mantenimiento edilicio", 46, 605, 9);
  right(ctx, "1", 380, 605, 9);
  right(ctx, "450.000,00", 450, 605, 9);
  right(ctx, "450.000,00", 548, 605, 9);

  ctx.page.drawLine({ start: { x: 40, y: 590 }, end: { x: 555, y: 590 }, thickness: 0.8, color: GRAY });

  right(ctx, "Total:", 460, 560, 11, true);
  right(ctx, "450.000,00", 548, 560, 11, true);

  text(ctx, "Comprobante sin CAE impreso (caso de prueba).", 40, 520, 9, false, GRAY);

  return pdf.save();
}

async function facturaExteriorEastRepair() {
  const { pdf, ctx } = await newPage();

  text(ctx, "INVOICE", 40, 780, 30, true);
  text(ctx, "East Repair Inc.", 40, 730, 11, true);
  text(ctx, "1912 Harvest Lane", 40, 716, 9);
  text(ctx, "New York, NY 12210", 40, 703, 9);

  text(ctx, "BILL TO", 40, 660, 9, true);
  text(ctx, "John Smith", 40, 646, 9);
  text(ctx, "2 Court Square", 40, 633, 9);
  text(ctx, "New York, NY 12210", 40, 620, 9);

  text(ctx, "SHIP TO", 230, 660, 9, true);
  text(ctx, "John Smith", 230, 646, 9);
  text(ctx, "3787 Pineview Drive", 230, 633, 9);
  text(ctx, "Cambridge, MA 12210", 230, 620, 9);

  text(ctx, "INVOICE #", 400, 660, 9, true);
  right(ctx, "US-001", 548, 660, 9);
  text(ctx, "INVOICE DATE", 400, 646, 9, true);
  right(ctx, "11/02/2019", 548, 646, 9);
  text(ctx, "P.O.#", 400, 633, 9, true);
  right(ctx, "2312/2019", 548, 633, 9);
  text(ctx, "DUE DATE", 400, 620, 9, true);
  right(ctx, "26/02/2019", 548, 620, 9);

  tableHeader(ctx, 590, [
    { label: "QTY", x: 46 },
    { label: "DESCRIPTION", x: 120 },
    { label: "UNIT PRICE", x: 400, right: 470 },
    { label: "AMOUNT", x: 500, right: 548 },
  ]);

  const rows = [
    ["1", "Front and rear brake cables", "100.00", "100.00"],
    ["2", "New set of pedal arms", "15.00", "30.00"],
    ["3", "Labor 3hrs", "5.00", "15.00"],
  ];
  let y = 565;
  for (const [qty, desc, unit, amount] of rows) {
    text(ctx, qty, 46, y, 9);
    text(ctx, desc, 120, y, 9);
    right(ctx, unit, 470, y, 9);
    right(ctx, amount, 548, y, 9);
    y -= 18;
  }

  ctx.page.drawLine({ start: { x: 40, y: y + 8 }, end: { x: 555, y: y + 8 }, thickness: 0.8, color: GRAY });

  right(ctx, "Subtotal", 470, y - 10, 9);
  right(ctx, "145.00", 548, y - 10, 9);
  right(ctx, "Sales Tax 6.25%", 470, y - 26, 9);
  right(ctx, "9.06", 548, y - 26, 9);
  right(ctx, "TOTAL", 470, y - 46, 11, true);
  right(ctx, "$154.06", 548, y - 46, 11, true);

  text(ctx, "TERMS & CONDITIONS", 40, 150, 9, true);
  text(ctx, "Payment is due within 15 days", 40, 136, 9);
  text(ctx, "Please make checks payable to: East Repair Inc.", 40, 122, 9);

  return pdf.save();
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const files: Array<[string, Uint8Array]> = [
    ["factura-a-aceros.pdf", await facturaA()],
    ["factura-exterior-systemsx.pdf", await facturaExteriorSystemsx()],
    ["factura-exterior-protectec.pdf", await facturaExteriorProtectec()],
    ["factura-c-sin-cae.pdf", await facturaCSinCae()],
    ["factura-exterior-east-repair.pdf", await facturaExteriorEastRepair()],
  ];

  for (const [name, bytes] of files) {
    const path = join(OUT_DIR, name);
    writeFileSync(path, bytes);
    console.log(`✓ ${path} (${bytes.length} bytes)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
