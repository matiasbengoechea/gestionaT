'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import { CLIENTS, getClient } from '@/lib/clients'
import { isValidCuit } from '@/lib/cuit'
import type { InvoiceData, ValidationIssue } from '@/lib/types'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CircleHelp, FileText, Folders,
  Maximize2, Move, Pencil, Plus, Redo2, Tag, Trash2, Undo2, Upload, ZoomOut,
} from 'lucide-react'

type Invoice = {
  id: number; company: string; activity: string; year: string; date: string; entry: string
  number: string; supplier: string; total: string; status: 'green' | 'amber' | 'red'
  nif: string; concept: string; fileUrl?: string; fileName?: string; fileType?: string; provisionalNif?: boolean
  data?: InvoiceData; issues?: ValidationIssue[]; processing?: boolean; error?: string
}

const initialInvoices: Invoice[] = [
  { id: 1, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '01/07/2026', entry: '01/07/2026', number: '024/2026', supplier: 'SYSTEMSX LTD', total: '3.500,00', status: 'green', nif: 'B12345678', concept: 'Servicios profesionales' },
  { id: 2, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '01/08/2026', entry: '01/08/2026', number: '027/2026', supplier: 'SYSTEMSX LTD', total: '3.888,90', status: 'green', nif: 'B12345678', concept: 'Servicios profesionales' },
  { id: 3, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '01/09/2026', entry: '01/09/2026', number: '040/2026', supplier: 'SYSTEMSX LTD', total: '4.099,45', status: 'green', nif: 'B12345678', concept: 'Servicios profesionales' },
  { id: 4, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '01/07/2026', entry: '01/07/2026', number: '026/2026', supplier: 'SIMPLEXITY TRAVEL', total: '700,00', status: 'red', nif: '07849358X', concept: 'Ntra fra. nº 026/2026' },
  { id: 5, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '01/08/2026', entry: '01/08/2026', number: '031/2026', supplier: 'PROTECTEC LTD', total: '1.250,00', status: 'red', nif: 'B87654321', concept: 'Servicios técnicos' },
  { id: 6, company: 'OSBORNE WAINE', activity: '01 - 755.1 - SER', year: '2026', date: '01/09/2026', entry: '01/09/2026', number: '043/2026', supplier: 'CLOUD SERVICES', total: '980,00', status: 'red', nif: 'B55667788', concept: 'Suscripción de servicios' },
]

const statusColors = { green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-rose-500' }
const formatTotal = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  return year && month && day ? `${day}/${month}/${year}` : iso
}

function mapInvoice(
  data: InvoiceData,
  issues: ValidationIssue[],
  company: string,
  activity: string,
): Partial<Invoice> {
  const status: Invoice['status'] = issues.some((issue) => issue.severity === 'error')
    ? 'red'
    : issues.some((issue) => issue.severity === 'warning')
      ? 'amber'
      : 'green'
  const first = data.items[0]
  const concept = first
    ? data.items.length > 1
      ? `${first.descripcion} (+${data.items.length - 1})`
      : first.descripcion
    : data.observaciones
  return {
    company,
    activity,
    year: data.fechaEmision ? data.fechaEmision.slice(0, 4) : '—',
    date: formatDate(data.fechaEmision),
    entry: formatDate(data.fechaEmision),
    number: data.puntoDeVenta ? `${data.puntoDeVenta}-${data.numero}` : data.numero || '—',
    supplier: data.emisor.razonSocial || '—',
    total: formatTotal(data.total),
    status,
    nif: data.emisor.cuit || '—',
    concept: concept || '—',
    provisionalNif: data.origen === 'local' && !isValidCuit(data.emisor.cuit),
    data,
    issues,
  }
}

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [selectedId, setSelectedId] = useState(4)
  const [checked, setChecked] = useState<number[]>([1, 2, 3, 4])
  const [saved, setSaved] = useState(false)
  const [clientId, setClientId] = useState(CLIENTS[0].id)
  const selected = useMemo(() => invoices.find((invoice) => invoice.id === selectedId) ?? invoices[0], [invoices, selectedId])

  const toggleChecked = (id: number) => setChecked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const updateSelected = (key: keyof Invoice, value: string) => setInvoices((current) => current.map((invoice) => invoice.id === selected.id ? { ...invoice, [key]: value } : invoice))

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    const client = getClient(clientId) ?? CLIENTS[0]
    const firstId = Math.max(0, ...invoices.map((invoice) => invoice.id)) + 1
    const placeholders = files.map((file, index): Invoice => ({
      id: firstId + index,
      company: client.nombre,
      activity: client.rubro,
      year: '—',
      date: '—',
      entry: '—',
      number: 'Leyendo…',
      supplier: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').toUpperCase(),
      total: '—',
      status: 'amber',
      nif: '—',
      concept: 'Procesando con IA…',
      fileUrl: URL.createObjectURL(file),
      fileName: file.name,
      fileType: file.type,
      processing: true,
    }))
    setInvoices((current) => [...placeholders, ...current])
    setSelectedId(firstId)
    setChecked((current) => [...placeholders.map((invoice) => invoice.id), ...current])
    event.target.value = ''

    void (async () => {
      for (const [index, file] of files.entries()) {
        const id = firstId + index
        try {
          const form = new FormData()
          form.append('file', file)
          form.append('clientId', client.id)
          const response = await fetch('/api/extract', { method: 'POST', body: form })
          const payload = await response.json()
          if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error ?? `Error ${response.status} al procesar la factura.`)
          }
          const data = payload.invoice as InvoiceData
          const issues = payload.issues as ValidationIssue[]
          setInvoices((current) =>
            current.map((invoice) =>
              invoice.id === id
                ? {
                    ...invoice,
                    ...mapInvoice(data, issues, client.nombre, client.rubro),
                    processing: false,
                  }
                : invoice,
            ),
          )
        } catch (error) {
          setInvoices((current) =>
            current.map((invoice) =>
              invoice.id === id
                ? {
                    ...invoice,
                    status: 'red',
                    processing: false,
                    number: 'Error',
                    concept: 'No se pudo procesar',
                    total: '—',
                    error: error instanceof Error ? error.message : 'Error inesperado.',
                  }
                : invoice,
            ),
          )
        }
      }
    })()
  }

  return (
    <main className="flex h-screen min-w-[1080px] flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-5">
        <div className="flex items-center gap-5"><button className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="size-4 text-muted-foreground" /> Identificación de facturas</button><label className="flex items-center gap-2 text-xs text-muted-foreground">Empresa<select value={clientId} onChange={(event) => setClientId(event.target.value)} className="h-8 rounded-md border bg-background px-2 text-xs text-foreground">{CLIENTS.map((client) => <option key={client.id} value={client.id}>{client.nombre}</option>)}</select></label><label className="button-primary cursor-pointer"><Upload className="size-4" /> Subir Facturas<input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg" multiple onChange={handleUpload} /></label><button className="flex items-center gap-2 text-sm font-medium text-destructive hover:opacity-75"><Trash2 className="size-4" /> Eliminar</button></div>
        <div className="flex items-center gap-1"><button className="toolbar-button"><Folders className="size-4" /> Plan Contable</button><button className="toolbar-button"><Tag className="size-4" /> Etiquetas</button><button className="icon-button" aria-label="Ayuda"><CircleHelp className="size-5" /></button><div className="ml-3 size-7 rounded-full bg-primary text-center text-xs font-bold leading-7 text-primary-foreground">AG</div></div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-[1.15] flex-col border-r bg-card">
          <div className="flex h-11 shrink-0 items-center justify-between border-b bg-sky-50 px-4 text-xs text-slate-700"><span className="font-semibold">{invoices.length} Facturas: <span className="font-normal">{invoices.filter((invoice) => invoice.fileUrl).length} Importadas, {invoices.length} Interpretadas</span></span><div className="flex items-center gap-3 text-[11px]"><span className="flex items-center gap-1"><i className="status-dot bg-emerald-500" /> Verdes</span><span className="flex items-center gap-1"><i className="status-dot bg-amber-400" /> Ámbar</span><span className="flex items-center gap-1"><i className="status-dot bg-rose-500" /> Rojas</span><span>{checked.length} Seleccionadas</span></div></div>
          <div className="min-h-0 flex-[0.9] overflow-auto border-b"><table className="w-full min-w-[920px] border-collapse text-[11px]"><thead className="sticky top-0 z-10 bg-muted text-left font-semibold text-muted-foreground"><tr>{['Estado', 'Empresa', 'Actividad', 'Ejercicio', 'Fecha Factura', 'Fecha Asiento', 'Nº Factura', 'Cliente / Proveedor', 'Total'].map((heading) => <th key={heading} className="whitespace-nowrap border-b px-2.5 py-2">{heading}</th>)}</tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id} onClick={() => { setSelectedId(invoice.id); setSaved(false) }} className={`cursor-pointer border-b transition-colors hover:bg-blue-50 ${selectedId === invoice.id ? 'bg-blue-100' : ''}`}><td className="px-2.5 py-2"><div className="flex items-center gap-2"><input aria-label={`Seleccionar factura ${invoice.number}`} type="checkbox" checked={checked.includes(invoice.id)} onChange={() => toggleChecked(invoice.id)} onClick={(event) => event.stopPropagation()} className="accent-primary" /><i className={`status-dot ${statusColors[invoice.status]}`} /></div></td><td className="whitespace-nowrap px-2.5 py-2 font-medium">{invoice.company}</td><td className="whitespace-nowrap px-2.5 py-2 text-muted-foreground">{invoice.activity}</td><td className="px-2.5 py-2">{invoice.year}</td><td className="whitespace-nowrap px-2.5 py-2">{invoice.date}</td><td className="whitespace-nowrap px-2.5 py-2">{invoice.entry}</td><td className="px-2.5 py-2">{invoice.number}</td><td className="whitespace-nowrap px-2.5 py-2">{invoice.supplier}</td><td className="whitespace-nowrap px-2.5 py-2 text-right font-medium">{invoice.total}</td></tr>)}</tbody></table></div>
          <div className="flex h-12 shrink-0 items-center gap-5 border-b px-4 text-xs font-medium text-primary"><button onClick={() => setChecked(invoices.map((invoice) => invoice.id))}>Marcar todas</button><button onClick={() => setChecked([])}>Desmarcar todas</button><button onClick={() => setSaved(true)}>Revisar</button></div>

          <div className="min-h-0 flex-[1.1] overflow-auto px-5 py-3"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold tracking-tight">Detalle de factura</h2><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Estado:</span><i className="status-dot bg-emerald-500" /><i className="status-dot bg-amber-400" /><i className="status-dot bg-rose-500" /></div></div>
            <div className="grid grid-cols-4 gap-x-4 gap-y-3 text-xs"><label className="field-label">Nº Factura<input className="field-input" value={selected.number} onChange={(event) => updateSelected('number', event.target.value)} /></label><label className="field-label">Fecha factura<input className="field-input" value={selected.date} onChange={(event) => updateSelected('date', event.target.value)} /></label><label className="field-label">Fecha asiento<input className="field-input" value={selected.entry} onChange={(event) => updateSelected('entry', event.target.value)} /></label><label className="field-label">Fecha operación<input className="field-input" value={selected.date} readOnly /></label><label className="field-label col-span-2">Cliente / Proveedor<input className="field-input" value={selected.supplier} onChange={(event) => updateSelected('supplier', event.target.value)} /></label><label className="field-label">N.I.F.<input className="field-input" value={selected.nif} onChange={(event) => updateSelected('nif', event.target.value)} /></label><label className="field-label">Cuenta<input className="field-input" value={selected.data?.items[0]?.cuentaContable ?? ''} readOnly /></label><label className="field-label col-span-2">Concepto<input className="field-input" value={selected.concept} onChange={(event) => updateSelected('concept', event.target.value)} /></label><label className="field-label">Total fra.<input className="field-input text-right font-semibold" value={selected.total} onChange={(event) => updateSelected('total', event.target.value)} /></label><label className="field-label">Cuenta tesor. para fras. contado<input className="field-input" value="" readOnly /></label></div>
            {selected.provisionalNif && <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>Aviso: el CUIT del emisor no es válido o no figura en la factura. Revisalo antes de contabilizar.</span></div>}
            <div className="mt-4 overflow-hidden rounded-md border"><div className="flex items-center justify-between border-b bg-muted px-3 py-2 text-xs font-semibold"><span>Detalle factura</span><span className="font-normal text-muted-foreground">{selected.data ? `${selected.data.items.length} ítems` : ''}</span></div><table className="w-full text-xs"><thead className="text-muted-foreground"><tr>{['Op.', 'Descripción', 'Base', 'Tipo', '%', 'Cuota', 'Recargo', 'Retención', 'Contrapartida'].map((heading) => <th key={heading} className="px-2 py-2 text-left font-medium">{heading}</th>)}</tr></thead><tbody>{selected.data && selected.data.items.length > 0 ? selected.data.items.map((item, index) => (<tr key={index} className="border-t"><td className="px-2 py-2">{index + 1}</td><td className="px-2 py-2">{item.descripcion}{item.descripcionOriginal && item.descripcionOriginal !== item.descripcion ? <span className="block text-[10px] text-muted-foreground">orig: {item.descripcionOriginal}</span> : null}</td><td className="px-2 py-2">{formatTotal(item.importe)}</td><td className="px-2 py-2">{item.alicuotaIva > 0 ? 'IVA' : '—'}</td><td className="px-2 py-2">{item.alicuotaIva || '—'}</td><td className="px-2 py-2">{item.alicuotaIva > 0 ? formatTotal((item.importe * item.alicuotaIva) / 100) : '—'}</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">{item.cuentaContable || '—'}</td></tr>)) : (<tr className="border-t"><td className="px-2 py-2">—</td><td className="px-2 py-2">{selected.concept}</td><td className="px-2 py-2">{selected.total}</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td></tr>)}</tbody></table></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><div className="mb-1 font-semibold">Observaciones</div><textarea key={selected.id} defaultValue={selected.data?.observaciones ?? ''} className="h-16 w-full resize-none rounded-md border bg-background p-2" /></div><div><div className="mb-1 font-semibold">Incidencias</div><div className={`h-16 overflow-auto rounded-md border p-2 font-medium ${selected.error || (selected.issues ?? []).some((issue) => issue.severity === 'error') ? 'border-rose-200 bg-rose-50 text-rose-600' : (selected.issues ?? []).some((issue) => issue.severity === 'warning') ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{selected.error ? selected.error : selected.processing ? 'Procesando con IA…' : (selected.issues ?? []).length > 0 ? (selected.issues ?? []).map((issue) => issue.message).join(' · ') : 'Sin incidencias.'}</div></div></div>
          </div><div className="flex shrink-0 justify-end gap-2 border-t bg-muted/30 px-5 py-3"><button className="button-secondary">Cancelar</button><button onClick={() => setSaved(true)} className="button-primary">{saved ? <Check className="size-4" /> : null}{saved ? 'Guardado' : 'Guardar'}</button></div>
        </section>

        <aside className="flex min-w-[380px] flex-[0.85] flex-col bg-slate-100"><div className="flex h-12 shrink-0 items-center gap-1 border-b bg-card px-3"><button className="viewer-button"><Plus /></button><button className="viewer-button"><ZoomOut /></button><button className="viewer-button"><ArrowLeft /></button><button className="viewer-button"><ArrowRight /></button><button className="viewer-button"><Move /></button><button className="viewer-button"><Undo2 /></button><button className="viewer-button"><Redo2 /></button><div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><span>1 / 1</span><button className="viewer-button"><Maximize2 /></button></div></div><div className="min-h-0 flex-1 overflow-auto p-8">{selected.fileUrl ? (selected.fileType === 'application/pdf' ? <iframe title={`Documento ${selected.fileName}`} src={selected.fileUrl} className="h-full min-h-[720px] w-full rounded bg-white shadow-sm" /> : <div className="flex min-h-[720px] items-start justify-center rounded bg-white p-5 shadow-sm"><img src={selected.fileUrl} alt={`Factura cargada ${selected.fileName}`} className="max-h-[850px] max-w-full object-contain" /></div>) : <div className="mx-auto min-h-[720px] max-w-[620px] bg-white p-12 shadow-sm text-slate-800"><div className="flex justify-between text-[10px]"><div><div className="font-bold">Daniel Steven Osborne Waine</div><p className="mt-2 leading-4">71 Vista Dorado<br />Calle Einstein 8, Sonneliland<br />España</p></div><div className="text-right"><div className="text-2xl font-black tracking-tight">INVOICE</div><p className="mt-3 font-bold">INVOICE # &nbsp; {selected.number}</p><p>DATE &nbsp; <mark>{selected.date}</mark></p></div></div><div className="mt-12 border-t-2 border-slate-900 pt-4 text-[10px]"><div className="font-bold">BILL TO</div><div className="mt-2 font-semibold">{selected.supplier}</div><p>Factura interpretada por GestionaT IA.</p></div><div className="mt-8"><div className="flex bg-slate-900 px-3 py-2 font-bold text-white"><span className="flex-1">DESCRIPTION</span><span>AMOUNT</span></div><div className="flex min-h-28 border-x border-b border-slate-400 px-3 py-3"><span className="flex-1">{selected.concept}</span><span className="font-bold">{selected.total}</span></div><div className="flex justify-end border-x border-b border-slate-400 px-3 py-3 font-bold">TOTAL &nbsp; {selected.total}</div></div></div>}</div></aside>
      </div>
    </main>
  )
}
