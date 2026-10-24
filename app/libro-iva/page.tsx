import type { Metadata } from 'next'
import { BookHeader, money } from '@/components/book-header'

export const metadata: Metadata = {
  title: 'GestionaT · Libro IVA Compras',
  description: 'Vista de ejemplo del Libro IVA Compras generado a partir de las facturas aprobadas.',
}

const rows = [
  { fecha: '01/07/2026', comprobante: 'Factura A', numero: '0003-00001245', proveedor: 'Estudio Pérez y Asociados', cuit: '30-71234567-8', neto: 100000, iva21: 21000, iva105: 0, percepciones: 0 },
  { fecha: '03/07/2026', comprobante: 'Factura A', numero: '0012-00008831', proveedor: 'Telecom Argentina S.A.', cuit: '30-63945373-8', neto: 45000, iva21: 9450, iva105: 0, percepciones: 1350 },
  { fecha: '08/07/2026', comprobante: 'Factura A', numero: '0005-00004410', proveedor: 'Distribuidora Norte S.R.L.', cuit: '30-70987654-3', neto: 80000, iva21: 0, iva105: 8400, percepciones: 0 },
  { fecha: '15/07/2026', comprobante: 'Nota de Crédito A', numero: '0003-00000087', proveedor: 'Estudio Pérez y Asociados', cuit: '30-71234567-8', neto: -10000, iva21: -2100, iva105: 0, percepciones: 0 },
]

const rowTotal = (row: (typeof rows)[number]) => row.neto + row.iva21 + row.iva105 + row.percepciones

const totals = rows.reduce(
  (acc, row) => ({
    neto: acc.neto + row.neto,
    iva21: acc.iva21 + row.iva21,
    iva105: acc.iva105 + row.iva105,
    percepciones: acc.percepciones + row.percepciones,
    total: acc.total + rowTotal(row),
  }),
  { neto: 0, iva21: 0, iva105: 0, percepciones: 0, total: 0 },
)

const headings = ['Fecha', 'Comprobante', 'Número', 'Proveedor', 'CUIT', 'Neto gravado', 'IVA 21%', 'IVA 10,5%', 'Percepciones', 'Total']

export default function LibroIvaPage() {
  return (
    <main className="mx-auto flex max-w-[1200px] flex-col gap-5 p-6">
      <BookHeader title="Libro IVA Compras" period="Julio 2026" company="Osborne Waine" />

      <section className="overflow-x-auto rounded-md border bg-card" aria-label="Detalle de comprobantes">
        <table className="w-full min-w-[960px] border-collapse text-xs">
          <thead className="bg-muted text-left font-semibold text-muted-foreground">
            <tr>
              {headings.map((heading, index) => (
                <th key={heading} className={`whitespace-nowrap border-b px-3 py-2.5 ${index >= 5 ? 'text-right' : ''}`}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.numero + row.comprobante} className="border-b last:border-b-0">
                <td className="whitespace-nowrap px-3 py-2.5">{row.fecha}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{row.comprobante}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono">{row.numero}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium">{row.proveedor}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono">{row.cuit}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(row.neto)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(row.iva21)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(row.iva105)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(row.percepciones)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(rowTotal(row))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted font-semibold">
            <tr>
              <td colSpan={5} className="px-3 py-2.5 text-right">Totales</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.neto)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.iva21)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.iva105)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.percepciones)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section aria-label="Resumen del período" className="grid grid-cols-3 gap-3">
        {[
          { label: 'Crédito fiscal IVA', value: totals.iva21 + totals.iva105 },
          { label: 'Percepciones sufridas', value: totals.percepciones },
          { label: 'Total del período', value: totals.total },
        ].map((item) => (
          <div key={item.label} className="rounded-md border bg-card p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">$ {money(item.value)}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
