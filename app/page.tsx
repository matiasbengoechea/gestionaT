'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  FileCheck2,
  FileText,
  Folders,
  Languages,
  LayoutGrid,
  Maximize2,
  MoreHorizontal,
  Move,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

const invoices = [
  { id: 1, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '01/07/2026', entry: '01/07/2026', number: '024/2026', supplier: 'SYSTEMSX LTD', total: '3.500,00', status: 'green' },
  { id: 2, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '01/08/2026', entry: '01/08/2026', number: '027/2026', supplier: 'SYSTEMSX LTD', total: '3.888,90', status: 'green' },
  { id: 3, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '01/09/2026', entry: '01/09/2026', number: '040/2026', supplier: 'SYSTEMSX LTD', total: '4.099,45', status: 'green' },
  { id: 4, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '01/07/2026', entry: '01/07/2026', number: '026/2026', supplier: 'SIMPLEXITY TRAVEL', total: '700,00', status: 'red' },
  { id: 5, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '01/08/2026', entry: '01/08/2026', number: '031/2026', supplier: 'PROTECTEC LTD', total: '1.250,00', status: 'red' },
  { id: 6, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '01/09/2026', entry: '01/09/2026', number: '043/2026', supplier: 'CLOUD SERVICES', total: '980,00', status: 'red' },
  { id: 7, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '02/09/2026', entry: '02/09/2026', number: '045/2026', supplier: 'OFFICE WORLD', total: '245,50', status: 'red' },
]

const statusColors = { green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-rose-500' }

export default function Home() {
  const [selectedId, setSelectedId] = useState(4)
  const [checked, setChecked] = useState<number[]>([1, 2, 3, 4])
  const [saved, setSaved] = useState(false)
  const selected = useMemo(() => invoices.find((invoice) => invoice.id === selectedId) ?? invoices[3], [selectedId])

  const toggleChecked = (id: number) => setChecked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  return (
    <main className="flex h-screen min-w-[1080px] flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-5">
        <div className="flex items-center gap-5">
          <button className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="size-4 text-muted-foreground" /> Identificación de facturas</button>
          <button className="flex items-center gap-2 text-sm font-medium text-destructive hover:opacity-75"><Trash2 className="size-4" /> Eliminar</button>
        </div>
        <div className="flex items-center gap-1">
          <button className="toolbar-button"><Folders className="size-4" /> Plan Contable</button>
          <button className="toolbar-button"><Tag className="size-4" /> Etiquetas</button>
          <button className="icon-button" aria-label="Ayuda"><CircleHelp className="size-5" /></button>
          <div className="ml-3 size-7 rounded-full bg-primary text-center text-xs font-bold leading-7 text-primary-foreground">AG</div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-[1.15] flex-col border-r bg-card">
          <div className="flex h-11 shrink-0 items-center justify-between border-b bg-sky-50 px-4 text-xs text-slate-700">
            <span className="font-semibold">12 Facturas: <span className="font-normal">0 Importadas, 9 Interpretadas</span></span>
            <div className="flex items-center gap-3 text-[11px]"><span className="flex items-center gap-1"><i className="status-dot bg-emerald-500" /> 0 Verdes</span><span className="flex items-center gap-1"><i className="status-dot bg-amber-400" /> 0 Ámbar</span><span className="flex items-center gap-1"><i className="status-dot bg-rose-500" /> 9 Rojas</span><span>3 Revisadas</span></div>
          </div>

          <div className="min-h-0 flex-[0.9] overflow-auto border-b">
            <table className="w-full min-w-[920px] border-collapse text-[11px]">
              <thead className="sticky top-0 z-10 bg-muted text-left font-semibold text-muted-foreground">
                <tr>{['Estado', 'Empresa', 'Actividad', 'Ejercicio', 'Fecha Factura', 'Fecha Asiento', 'Nº Factura', 'Cliente / Proveedor', 'Total'].map((heading) => <th key={heading} className="whitespace-nowrap border-b px-2.5 py-2">{heading}</th>)}</tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => <tr key={invoice.id} onClick={() => setSelectedId(invoice.id)} className={`cursor-pointer border-b transition-colors hover:bg-blue-50 ${selectedId === invoice.id ? 'bg-blue-100' : ''}`}>
                  <td className="px-2.5 py-2"><div className="flex items-center gap-2"><input aria-label={`Seleccionar factura ${invoice.number}`} type="checkbox" checked={checked.includes(invoice.id)} onChange={() => toggleChecked(invoice.id)} onClick={(event) => event.stopPropagation()} className="accent-primary" /><i className={`status-dot ${statusColors[invoice.status as keyof typeof statusColors]}`} /></div></td>
                  <td className="whitespace-nowrap px-2.5 py-2 font-medium">{invoice.company}</td><td className="whitespace-nowrap px-2.5 py-2 text-muted-foreground">{invoice.activity}</td><td className="px-2.5 py-2">{invoice.year}</td><td className="whitespace-nowrap px-2.5 py-2">{invoice.date}</td><td className="whitespace-nowrap px-2.5 py-2">{invoice.entry}</td><td className="px-2.5 py-2">{invoice.number}</td><td className="whitespace-nowrap px-2.5 py-2">{invoice.supplier}</td><td className="whitespace-nowrap px-2.5 py-2 text-right font-medium">{invoice.total}</td>
                </tr>)}
              </tbody>
            </table>
          </div>

          <div className="flex h-12 shrink-0 items-center gap-5 border-b px-4 text-xs font-medium text-primary"><button onClick={() => setChecked(invoices.map((invoice) => invoice.id))}>Marcar todas</button><button onClick={() => setChecked([])}>Desmarcar todas</button><button>Asignar cuentas</button><button>Revisar</button><button>Interpretar por PDF</button><button>Interpretar por OCR</button></div>

          <div className="min-h-0 flex-[1.1] overflow-auto px-5 py-3">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold tracking-tight">Detalle de factura</h2><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Estado:</span><i className="status-dot bg-emerald-500" /><i className="status-dot bg-amber-400" /><i className="status-dot bg-rose-500" /></div></div>
            <div className="grid grid-cols-4 gap-x-4 gap-y-3 text-xs"><label className="field-label">Nº Factura<input className="field-input" value={selected.number} readOnly /></label><label className="field-label">Fecha factura<input className="field-input" value={selected.date} readOnly /></label><label className="field-label">Fecha asiento<input className="field-input" value={selected.entry} readOnly /></label><label className="field-label">Fecha operación<input className="field-input" value={selected.date} readOnly /></label><label className="field-label col-span-2">Cliente / Proveedor<input className="field-input" value="SIMPLEXITY TRAVEL MANAGEMENT LTD" readOnly /></label><label className="field-label">N.I.F.<input className="field-input" value="07849358X" readOnly /></label><label className="field-label">Cuenta<input className="field-input" value="43000005" readOnly /></label><label className="field-label col-span-2">Concepto<input className="field-input" value="Ntra fra. nº 026/2026" readOnly /></label><label className="field-label">Total fra.<input className="field-input text-right font-semibold" value={selected.total} readOnly /></label><label className="field-label">Cuenta tesor. para fras. contado<input className="field-input" value="" readOnly /></label></div>
            <div className="mt-4 overflow-hidden rounded-md border"><div className="flex items-center justify-between border-b bg-muted px-3 py-2 text-xs font-semibold"><span>Detalle factura</span><button className="text-primary"><Pencil className="size-3.5" /></button></div><table className="w-full text-xs"><thead className="text-muted-foreground"><tr>{['Op.', 'Base', 'Tipo', '%', 'Cuota', 'Recargo', 'Retención', 'Impreso', 'Contrapartida'].map((heading) => <th key={heading} className="px-2 py-2 text-left font-medium">{heading}</th>)}</tr></thead><tbody><tr className="border-t"><td className="px-2 py-2">8</td><td className="px-2 py-2">700,00</td><td className="px-2 py-2">0</td><td className="px-2 py-2">0</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">347/415</td><td className="px-2 py-2">70500000</td></tr></tbody></table></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><div className="mb-1 font-semibold">Observaciones</div><textarea className="h-16 w-full resize-none rounded-md border bg-background p-2" /></div><div><div className="mb-1 font-semibold">Incidencias</div><div className="h-16 rounded-md border border-rose-200 bg-rose-50 p-2 font-medium text-rose-600">Número factura no encontrado.<br />Base o cuota calculadas.</div></div></div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t bg-muted/30 px-5 py-3"><button className="button-secondary">Cancelar</button><button onClick={() => setSaved(true)} className="button-primary">{saved ? <Check className="size-4" /> : null}{saved ? 'Guardado' : 'Guardar'}</button></div>
        </section>

        <aside className="flex min-w-[380px] flex-[0.85] flex-col bg-slate-100">
          <div className="flex h-12 shrink-0 items-center gap-1 border-b bg-card px-3"><button className="viewer-button"><Plus /></button><button className="viewer-button"><ZoomOut /></button><button className="viewer-button"><ArrowLeft /></button><button className="viewer-button"><ArrowRight /></button><button className="viewer-button"><Move /></button><button className="viewer-button"><Undo2 /></button><button className="viewer-button"><Redo2 /></button><div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><span>1 / 1</span><button className="viewer-button"><Maximize2 /></button></div></div>
          <div className="min-h-0 flex-1 overflow-auto p-8"><div className="mx-auto min-h-[720px] max-w-[620px] bg-white p-12 shadow-sm text-slate-800"><div className="flex justify-between text-[10px]"><div><div className="font-bold">Daniel Steven Osborne Waine</div><p className="mt-2 leading-4">71 Vista Dorado<br />Calle Einstein 8, Sonneliland<br />España</p></div><div className="text-right"><div className="text-2xl font-black tracking-tight">INVOICE</div><p className="mt-3 font-bold">INVOICE # &nbsp; 026/2026</p><p>DATE &nbsp; <mark>01/07/2026</mark></p></div></div><div className="mt-12 border-t-2 border-slate-900 pt-4 text-[10px]"><div className="font-bold">BILL TO</div><div className="mt-2 font-semibold">Simplexity Travel Management Limited</div><p>5th Floor, 3 Hanover Square, Mayfair, London, W1S 1HD,<br />United Kingdom.</p></div><div className="mt-8"><div className="flex bg-slate-900 px-3 py-2 font-bold text-white"><span className="flex-1">DESCRIPTION</span><span>AMOUNT</span></div><div className="flex min-h-28 border-x border-b border-slate-400 px-3 py-3"><span className="flex-1">Simplexity Travel Management consultancy services (June 2026)</span><span className="font-bold">GBP £700.00</span></div><div className="flex justify-end border-x border-b border-slate-400 px-3 py-3 font-bold">TOTAL &nbsp; GBP £700.00</div></div><div className="mt-12 text-[9px] leading-4"><div className="font-bold">BANK DETAILS:</div><p>Bank Name: Halifax<br />Account Name: Mr D S Osborne Waine<br />Sort Code: 11-05-54<br />Account Number: 01968570</p></div></div></div>
        </aside>
      </div>
    </main>
  )
}
