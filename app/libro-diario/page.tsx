import type { Metadata } from 'next'
import { BookHeader, money } from '@/components/book-header'

export const metadata: Metadata = {
  title: 'GestionaT · Libro Diario',
  description: 'Vista de ejemplo del Libro Diario generado a partir de las facturas aprobadas.',
}

type Line = { cuenta: string; nombre: string; debe: number; haber: number }
type Entry = { numero: number; fecha: string; descripcion: string; lineas: Line[] }

const entries: Entry[] = [
  {
    numero: 1,
    fecha: '01/07/2026',
    descripcion: 'Factura A 0003-00001245 · Estudio Pérez y Asociados',
    lineas: [
      { cuenta: '5.1.03', nombre: 'Honorarios profesionales', debe: 100000, haber: 0 },
      { cuenta: '1.1.04', nombre: 'IVA Crédito Fiscal 21%', debe: 21000, haber: 0 },
      { cuenta: '2.1.01', nombre: 'Proveedores', debe: 0, haber: 121000 },
    ],
  },
  {
    numero: 2,
    fecha: '03/07/2026',
    descripcion: 'Factura A 0012-00008831 · Telecom Argentina S.A.',
    lineas: [
      { cuenta: '5.1.07', nombre: 'Telefonía e internet', debe: 45000, haber: 0 },
      { cuenta: '1.1.04', nombre: 'IVA Crédito Fiscal 21%', debe: 9450, haber: 0 },
      { cuenta: '1.1.06', nombre: 'Percepciones IIBB a favor', debe: 1350, haber: 0 },
      { cuenta: '2.1.01', nombre: 'Proveedores', debe: 0, haber: 55800 },
    ],
  },
  {
    numero: 3,
    fecha: '08/07/2026',
    descripcion: 'Factura A 0005-00004410 · Distribuidora Norte S.R.L.',
    lineas: [
      { cuenta: '5.1.11', nombre: 'Insumos', debe: 80000, haber: 0 },
      { cuenta: '1.1.05', nombre: 'IVA Crédito Fiscal 10,5%', debe: 8400, haber: 0 },
      { cuenta: '2.1.01', nombre: 'Proveedores', debe: 0, haber: 88400 },
    ],
  },
  {
    numero: 4,
    fecha: '15/07/2026',
    descripcion: 'Nota de Crédito A 0003-00000087 · Estudio Pérez y Asociados',
    lineas: [
      { cuenta: '2.1.01', nombre: 'Proveedores', debe: 12100, haber: 0 },
      { cuenta: '5.1.03', nombre: 'Honorarios profesionales', debe: 0, haber: 10000 },
      { cuenta: '1.1.04', nombre: 'IVA Crédito Fiscal 21%', debe: 0, haber: 2100 },
    ],
  },
]

const sum = (lines: Line[], key: 'debe' | 'haber') => lines.reduce((acc, line) => acc + line[key], 0)
const allLines = entries.flatMap((entry) => entry.lineas)

export default function LibroDiarioPage() {
  return (
    <main className="mx-auto flex max-w-[1000px] flex-col gap-5 p-6">
      <BookHeader title="Libro Diario" period="Julio 2026" company="Osborne Waine" />

      <section className="overflow-x-auto rounded-md border bg-card" aria-label="Asientos contables">
        <table className="w-full min-w-[760px] border-collapse text-xs">
          <thead className="bg-muted text-left font-semibold text-muted-foreground">
            <tr>
              <th className="border-b px-3 py-2.5">Cuenta</th>
              <th className="border-b px-3 py-2.5">Denominación</th>
              <th className="border-b px-3 py-2.5 text-right">Debe</th>
              <th className="border-b px-3 py-2.5 text-right">Haber</th>
            </tr>
          </thead>
          {entries.map((entry) => (
            <tbody key={entry.numero} className="border-b">
              <tr className="bg-muted/40">
                <th colSpan={4} scope="colgroup" className="px-3 py-2 text-left font-semibold">
                  Asiento {entry.numero} · {entry.fecha}
                  <span className="ml-2 font-normal text-muted-foreground">{entry.descripcion}</span>
                </th>
              </tr>
              {entry.lineas.map((line) => (
                <tr key={line.cuenta + line.nombre} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{line.cuenta}</td>
                  <td className={`px-3 py-2 ${line.haber > 0 ? 'pl-8' : ''}`}>{line.nombre}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.debe > 0 ? money(line.debe) : ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.haber > 0 ? money(line.haber) : ''}</td>
                </tr>
              ))}
              <tr className="border-t text-muted-foreground">
                <td colSpan={2} className="px-3 py-1.5 text-right">Suma del asiento</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(sum(entry.lineas, 'debe'))}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(sum(entry.lineas, 'haber'))}</td>
              </tr>
            </tbody>
          ))}
          <tfoot className="bg-muted font-semibold">
            <tr>
              <td colSpan={2} className="px-3 py-2.5 text-right">Totales del período</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(sum(allLines, 'debe'))}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(sum(allLines, 'haber'))}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </main>
  )
}
