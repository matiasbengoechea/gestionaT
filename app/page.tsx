'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_CLIENT_ID, getClient } from '@/lib/clients'
import { isValidCuit } from '@/lib/cuit'
import { formatMoney } from '@/lib/format'
import { sumTaxes } from '@/lib/validate'
import type { InvoiceData, ValidationIssue } from '@/lib/types'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, CircleHelp, FileText, Folders, Mail,
  Maximize2, Move, Pencil, Plus, Redo2, Tag, Trash2, Undo2, Upload, ZoomOut,
} from 'lucide-react'

type Invoice = {
  id: string; company: string; activity: string; year: string; date: string; entry: string
  number: string; supplier: string; total: string; status: 'green' | 'amber' | 'red'
  nif: string; concept: string; fileUrl?: string; fileName?: string; fileType?: string; provisionalNif?: boolean
  data?: InvoiceData; issues?: ValidationIssue[]; processing?: boolean; error?: string; reviewed?: boolean
  /** Metadata del mail que la trajo, para el aviso de llegada. */
  recibidoEn?: string; remitente?: string; asunto?: string
  /** Recién llegada: se resalta unos segundos y se limpia solo. */
  isNew?: boolean
}

/** Registro tal como lo devuelve `GET /api/invoices`. */
type ApiInvoice = {
  id: string
  recibidoEn?: string
  remitente?: string
  asunto?: string
  fileName: string
  fileUrl?: string
  clientId: string
  invoice: InvoiceData
  issues?: ValidationIssue[]
}

/** Factura vacía para mostrar el detalle cuando todavía no hay ninguna cargada. */
const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const blankInvoice: Invoice = {
  id: '',
  company: '',
  activity: '',
  year: '',
  date: '',
  entry: '',
  number: '',
  supplier: '',
  total: '',
  status: 'amber',
  nif: '',
  concept: '',
}

const statusColors = { green: 'bg-emerald-500', amber: 'bg-amber-400', red: 'bg-rose-500' }
const formatTotal = (value: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

const formatDate = (iso: string | null) => {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  return year && month && day ? `${day}/${month}/${year}` : iso
}

const fxRate = (data: InvoiceData) =>
  data.moneda !== 'ARS' && data.tipoCambio ? data.tipoCambio : 1

/** Si no hay cotización, se muestra la moneda original para no mentir. */
const displayCurrency = (data: InvoiceData) =>
  data.moneda !== 'ARS' && data.tipoCambio ? 'ARS' : data.moneda

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
    // La empresa es la del receptor del comprobante; si no figura, el cliente.
    company: data.receptor.razonSocial || company,
    activity,
    year: data.fechaEmision ? data.fechaEmision.slice(0, 4) : '—',
    date: formatDate(data.fechaEmision),
    entry: formatDate(data.fechaEmision),
    number: data.puntoDeVenta ? `${data.puntoDeVenta}-${data.numero}` : data.numero || '—',
    supplier: data.emisor.razonSocial || '—',
    total: formatMoney(data.total * fxRate(data), displayCurrency(data)),
    status,
    nif: data.emisor.cuit || '—',
    concept: concept || '—',
    provisionalNif: data.origen === 'local' && !isValidCuit(data.emisor.cuit),
    data,
    issues,
  }
}

function fileTypeFor(fileName: string, provided?: string): string {
  const name = fileName.toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.html') || name.endsWith('.htm')) return 'text/html'
  if (name.endsWith('.txt')) return 'text/plain'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.png')) return 'image/png'
  return provided || 'image/png'
}

function mapRecord(record: ApiInvoice): Invoice {
  const client = getClient(record.clientId)
  return {
    id: record.id,
    ...mapInvoice(record.invoice, record.issues ?? [], client?.nombre ?? '', client?.rubro ?? ''),
    fileName: record.fileName,
    fileUrl: record.fileUrl,
    fileType: fileTypeFor(record.fileName),
    reviewed: false,
    recibidoEn: record.recibidoEn,
    remitente: record.remitente,
    asunto: record.asunto,
  } as Invoice
}

const POLL_MS = 4000
const HIGHLIGHT_MS = 8000
const TOAST_MS = 7000


export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sentInfo, setSentInfo] = useState<{ facturas: number; renglones: number; totalArs: number } | null>(null)
  const [live, setLive] = useState<'connecting' | 'live' | 'paused' | 'error'>('connecting')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [arrival, setArrival] = useState<{ id: string; supplier: string; remitente?: string } | null>(null)
  // Cliente por defecto: el motor lo usa para el plan de cuentas y el receptor.
  const clientId = DEFAULT_CLIENT_ID
  const selected = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedId) ?? invoices[0] ?? blankInvoice,
    [invoices, selectedId],
  )

  // Ids ya conocidos: evita duplicar cuando el polling vuelve a traer la última factura.
  const knownIdsRef = useRef<Set<string>>(new Set())
  // Timestamp de la factura más nueva vista; el polling pide solo lo posterior.
  const lastSeenRef = useRef<string | null>(null)
  const highlightTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mergeRecords = useCallback((records: ApiInvoice[], highlight: boolean) => {
    const fresh = records.map(mapRecord).filter((record) => !knownIdsRef.current.has(record.id))
    if (fresh.length === 0) return []
    for (const record of fresh) knownIdsRef.current.add(record.id)
    const marked = highlight ? fresh.map((record) => ({ ...record, isNew: true })) : fresh
    // Las más nuevas van arriba, como llegan en la respuesta del servidor.
    setInvoices((current) => [...marked, ...current])
    return marked
  }, [])

  // Facturas que llegaron por mail (o por API): carga inicial + refresco en vivo.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    const apply = (records: ApiInvoice[], highlight: boolean) => {
      const fresh = mergeRecords(records, highlight)

      const newest = records.reduce<string | null>((max, record) => {
        const value = record.recibidoEn
        return value && (!max || value > max) ? value : max
      }, lastSeenRef.current)
      lastSeenRef.current = newest

      setLastSync(new Date())
      setLive('live')

      if (!highlight || fresh.length === 0) return

      const first = fresh[0]
      setArrival({ id: first.id, supplier: first.supplier, remitente: first.remitente })
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setArrival(null), TOAST_MS)

      for (const record of fresh) {
        const previous = highlightTimers.current.get(record.id)
        if (previous) clearTimeout(previous)
        highlightTimers.current.set(
          record.id,
          setTimeout(() => {
            setInvoices((current) =>
              current.map((invoice) => (invoice.id === record.id ? { ...invoice, isNew: false } : invoice)),
            )
            highlightTimers.current.delete(record.id)
          }, HIGHLIGHT_MS),
        )
      }
    }

    const poll = async (highlight: boolean) => {
      try {
        const since = lastSeenRef.current
        const url = since ? `/api/invoices?since=${encodeURIComponent(since)}` : '/api/invoices'
        const response = await fetch(url, { cache: 'no-store' })
        const payload = await response.json()
        if (cancelled) return
        if (!response.ok || !payload?.ok || !Array.isArray(payload.invoices)) {
          setLive('error')
          return
        }
        apply(payload.invoices as ApiInvoice[], highlight)
      } catch {
        if (!cancelled) setLive('error')
      }
    }

    void poll(false).then(() => {
      if (cancelled) return
      timer = setInterval(() => {
        if (document.visibilityState === 'hidden') {
          setLive('paused')
          return
        }
        void poll(true)
      }, POLL_MS)
    })

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void poll(true)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      if (toastTimer.current) clearTimeout(toastTimer.current)
      for (const timeout of highlightTimers.current.values()) clearTimeout(timeout)
      highlightTimers.current.clear()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [mergeRecords])

  const toggleChecked = (id: string) => setChecked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const updateSelected = (key: keyof Invoice, value: string) => setInvoices((current) => current.map((invoice) => invoice.id === selected.id ? { ...invoice, [key]: value } : invoice))

  const markReviewed = (id: string) => setInvoices((current) => current.map((invoice) => invoice.id === id ? { ...invoice, reviewed: true } : invoice))

  const saveCurrent = () => {
    if (!selected) return
    markReviewed(selected.id)
    setSaved(true)
  }

  const reviewCurrent = () => {
    if (!selected) return
    markReviewed(selected.id)
    const index = invoices.findIndex((invoice) => invoice.id === selected.id)
    const next = invoices[index + 1]
    if (next) setSelectedId(next.id)
    setSaved(true)
  }

  const saveAllAndSend = async () => {
    const withData = invoices.filter((invoice) => invoice.data)
    if (withData.length === 0) return

    setSending(true)
    setSendError(null)

    try {
      const response = await fetch('/api/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          invoices: withData.map((invoice) => invoice.data),
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? `Error ${response.status} al generar la salida.`)
      }

      const blob = new Blob([`\uFEFF${payload.csv}`], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${payload.batch.id}.csv`
      link.click()
      URL.revokeObjectURL(url)

      setInvoices((current) =>
        current.map((invoice) => (invoice.data ? { ...invoice, reviewed: true } : invoice)),
      )
      setSentInfo(payload.batch.metricas)
      setSent(true)
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'No se pudo enviar.')
    } finally {
      setSending(false)
    }
  }

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    const client = getClient(clientId) ?? getClient(DEFAULT_CLIENT_ID)!
    const ids = files.map(() => newId())
    const placeholders = files.map((file, index): Invoice => ({
      id: ids[index],
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
      fileType: fileTypeFor(file.name, file.type),
      processing: true,
    }))
    setInvoices((current) => [...placeholders, ...current])
    setSelectedId(ids[0])
    setChecked((current) => [...placeholders.map((invoice) => invoice.id), ...current])
    event.target.value = ''

    void (async () => {
      for (const [index, file] of files.entries()) {
        const id = ids[index]
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
        <div className="flex items-center gap-5"><button className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="size-4 text-muted-foreground" /> Identificación de facturas</button><label className="button-primary cursor-pointer"><Upload className="size-4" /> Subir Facturas<input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp,.html,.htm,.txt" multiple onChange={handleUpload} /></label><button className="flex items-center gap-2 text-sm font-medium text-destructive hover:opacity-75"><Trash2 className="size-4" /> Eliminar</button></div>
        <div className="flex items-center gap-1"><button className="toolbar-button"><Folders className="size-4" /> Plan Contable</button><button className="toolbar-button"><Tag className="size-4" /> Etiquetas</button><button className="icon-button" aria-label="Ayuda"><CircleHelp className="size-5" /></button><div className="ml-3 size-7 rounded-full bg-primary text-center text-xs font-bold leading-7 text-primary-foreground">AG</div></div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-[1.15] flex-col border-r bg-card">
          <div className="flex h-11 shrink-0 items-center justify-between border-b bg-sky-50 px-4 text-xs text-slate-700"><span className="font-semibold">{invoices.length} Facturas: <span className="font-normal">{invoices.filter((invoice) => invoice.fileUrl).length} Importadas, {invoices.length} Interpretadas</span></span><div className="flex items-center gap-3 text-[11px]"><span className="flex items-center gap-1.5" title={live === 'live' ? 'Actualizando cada 4 segundos' : live === 'paused' ? 'En pausa mientras la pestaña está oculta' : live === 'error' ? 'No se pudo consultar el servidor' : 'Conectando con el servidor'}><span className="relative flex size-2">{live === 'live' ? <span className="absolute inline-flex size-2 animate-ping rounded-full bg-emerald-400 opacity-75" /> : null}<span className={`relative inline-flex size-2 rounded-full ${live === 'live' ? 'bg-emerald-500' : live === 'error' ? 'bg-rose-500' : 'bg-slate-400'}`} /></span><span className="font-semibold">{live === 'live' ? 'En vivo' : live === 'paused' ? 'En pausa' : live === 'error' ? 'Sin conexión' : 'Conectando…'}</span>{lastSync ? <span className="text-slate-400">· {lastSync.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> : null}</span><span className="flex items-center gap-1"><i className="status-dot bg-emerald-500" /> Verdes</span><span className="flex items-center gap-1"><i className="status-dot bg-amber-400" /> Ámbar</span><span className="flex items-center gap-1"><i className="status-dot bg-rose-500" /> Rojas</span><span>{checked.length} Seleccionadas</span></div></div>
          <div className="min-h-0 flex-[0.9] overflow-auto border-b"><table className="w-full min-w-[920px] border-collapse text-[11px]"><thead className="sticky top-0 z-10 bg-muted text-left font-semibold text-muted-foreground"><tr>{['Estado', 'Empresa', 'Actividad', 'Ejercicio', 'Fecha Factura', 'Fecha Asiento', 'Nº Factura', 'Cliente / Proveedor', 'Total'].map((heading) => <th key={heading} className="whitespace-nowrap border-b px-2.5 py-2">{heading}</th>)}</tr></thead><tbody>{invoices.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center text-xs text-muted-foreground">Subí facturas para empezar. Se procesan de a una con IA.</td></tr> : null}{invoices.map((invoice) => <tr key={invoice.id} onClick={() => { setSelectedId(invoice.id); setSaved(false) }} className={`cursor-pointer border-b transition-colors hover:bg-blue-50 ${invoice.isNew ? 'bg-emerald-50' : ''} ${selectedId === invoice.id ? 'bg-blue-100' : ''}`}><td className="px-2.5 py-2"><div className="flex items-center gap-2"><input aria-label={`Seleccionar factura ${invoice.number}`} type="checkbox" checked={checked.includes(invoice.id)} onChange={() => toggleChecked(invoice.id)} onClick={(event) => event.stopPropagation()} className="accent-primary" />{invoice.reviewed ? <Check className="size-3.5 text-emerald-600" aria-label="Revisada" /> : <i className={`status-dot ${statusColors[invoice.status]}`} />}</div></td><td className="whitespace-nowrap px-2.5 py-2 font-medium">{invoice.company}</td><td className="whitespace-nowrap px-2.5 py-2 text-muted-foreground">{invoice.activity}</td><td className="px-2.5 py-2">{invoice.year}</td><td className="whitespace-nowrap px-2.5 py-2">{invoice.date}</td><td className="whitespace-nowrap px-2.5 py-2">{invoice.entry}</td><td className="px-2.5 py-2">{invoice.number}</td><td className="whitespace-nowrap px-2.5 py-2"><span className="flex items-center gap-1.5">{invoice.supplier}{invoice.isNew ? <span className="rounded bg-emerald-600 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Nueva</span> : null}</span></td><td className="whitespace-nowrap px-2.5 py-2 text-right font-medium">{invoice.total}</td></tr>)}</tbody></table></div>
          <div className="flex h-12 shrink-0 items-center gap-5 border-b px-4 text-xs font-medium text-primary"><button onClick={() => setChecked(invoices.map((invoice) => invoice.id))}>Marcar todas</button><button onClick={() => setChecked([])}>Desmarcar todas</button><button onClick={reviewCurrent}>Revisar</button><button onClick={saveCurrent}>Guardar</button></div>

          <div className="min-h-0 flex-[1.1] overflow-auto px-5 py-3"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold tracking-tight">Detalle de factura</h2><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Estado:</span><i className="status-dot bg-emerald-500" /><i className="status-dot bg-amber-400" /><i className="status-dot bg-rose-500" /></div></div>
            <div className="grid grid-cols-4 gap-x-4 gap-y-3 text-xs"><label className="field-label">Nº Factura<input className="field-input" value={selected.number} onChange={(event) => updateSelected('number', event.target.value)} /></label><label className="field-label">Fecha factura<input className="field-input" value={selected.date} onChange={(event) => updateSelected('date', event.target.value)} /></label><label className="field-label">Fecha asiento<input className="field-input" value={selected.entry} onChange={(event) => updateSelected('entry', event.target.value)} /></label><label className="field-label">Fecha operación<input className="field-input" value={selected.date} readOnly /></label><label className="field-label col-span-2">Cliente / Proveedor<input className="field-input" value={selected.supplier} onChange={(event) => updateSelected('supplier', event.target.value)} /></label><label className="field-label">N.I.F.<input className="field-input" value={selected.nif} onChange={(event) => updateSelected('nif', event.target.value)} /></label><label className="field-label">Cuenta<input className="field-input" value={selected.data?.items[0]?.cuentaContable ?? ''} readOnly /></label><label className="field-label col-span-2">Concepto<input className="field-input" value={selected.concept} onChange={(event) => updateSelected('concept', event.target.value)} /></label><label className="field-label">Total fra.<input className="field-input text-right font-semibold" value={selected.total} onChange={(event) => updateSelected('total', event.target.value)} /></label><label className="field-label">Cuenta tesor. para fras. contado<input className="field-input" value="" readOnly /></label></div>
            {selected.data ? (<div className="mt-4 grid grid-cols-3 gap-3 text-xs"><div className="rounded-md border p-3"><div className="text-muted-foreground">Base imponible</div><div className="mt-1 text-sm font-semibold">{formatMoney(selected.data.subtotal * fxRate(selected.data), displayCurrency(selected.data))}</div></div><div className="rounded-md border p-3"><div className="text-muted-foreground">Impuestos</div><div className="mt-1 text-sm font-semibold">{formatMoney((sumTaxes(selected.data.impuestos) + sumTaxes(selected.data.percepciones)) * fxRate(selected.data), displayCurrency(selected.data))}</div></div><div className="rounded-md border p-3"><div className="text-muted-foreground">Total</div><div className="mt-1 text-sm font-semibold">{formatMoney(selected.data.total * fxRate(selected.data), displayCurrency(selected.data))}</div></div></div>) : null}
            {selected.provisionalNif && <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>Aviso: el CUIT del emisor no es válido o no figura en la factura. Revisalo antes de contabilizar.</span></div>}
            <div className="mt-4 overflow-hidden rounded-md border"><div className="flex items-center justify-between border-b bg-muted px-3 py-2 text-xs font-semibold"><span>Detalle factura</span><span className="font-normal text-muted-foreground">{selected.data ? `${selected.data.items.length} ítems` : ''}</span></div><table className="w-full text-xs"><thead className="text-muted-foreground"><tr>{['Op.', 'Descripción', 'Base', 'Tipo', '%', 'Cuota', 'Recargo', 'Retención', 'Contrapartida'].map((heading) => <th key={heading} className="px-2 py-2 text-left font-medium">{heading}</th>)}</tr></thead><tbody>{selected.data && selected.data.items.length > 0 ? selected.data.items.map((item, index) => (<tr key={index} className="border-t"><td className="px-2 py-2">{index + 1}</td><td className="px-2 py-2">{item.descripcion}{item.descripcionOriginal && item.descripcionOriginal !== item.descripcion ? <span className="block text-[10px] text-muted-foreground">orig: {item.descripcionOriginal}</span> : null}</td><td className="px-2 py-2">{formatTotal(item.importe)}</td><td className="px-2 py-2">{item.alicuotaIva > 0 ? 'IVA' : '—'}</td><td className="px-2 py-2">{item.alicuotaIva || '—'}</td><td className="px-2 py-2">{item.alicuotaIva > 0 ? formatTotal((item.importe * item.alicuotaIva) / 100) : '—'}</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">{item.cuentaContable || '—'}</td></tr>)) : (<tr className="border-t"><td className="px-2 py-2">—</td><td className="px-2 py-2">{selected.concept}</td><td className="px-2 py-2">{selected.total}</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td><td className="px-2 py-2">—</td></tr>)}</tbody></table></div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><div className="mb-1 font-semibold">Observaciones</div><textarea key={selected.id} defaultValue={selected.data?.observaciones ?? ''} className="h-16 w-full resize-none rounded-md border bg-background p-2" /></div><div><div className="mb-1 font-semibold">Incidencias</div><div className={`h-16 overflow-auto rounded-md border p-2 font-medium ${selected.error || (selected.issues ?? []).some((issue) => issue.severity === 'error') ? 'border-rose-200 bg-rose-50 text-rose-600' : (selected.issues ?? []).some((issue) => issue.severity === 'warning') ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{selected.error ? selected.error : selected.processing ? 'Procesando con IA…' : (selected.issues ?? []).length > 0 ? (selected.issues ?? []).map((issue) => issue.message).join(' · ') : selected.data ? 'Sin incidencias.' : '—'}</div></div></div>
          </div><div className="flex shrink-0 items-center justify-end gap-3 border-t bg-muted/30 px-5 py-3">{sentInfo ? <span className="mr-auto text-xs text-muted-foreground">{sentInfo.facturas} facturas · {sentInfo.renglones} renglones · {formatMoney(sentInfo.totalArs, 'ARS')}</span> : null}{sendError ? <span className="mr-auto text-xs text-rose-600">{sendError}</span> : null}<button className="button-secondary">Cancelar</button><button onClick={saveAllAndSend} disabled={sending || invoices.every((invoice) => !invoice.data)} className="button-primary disabled:opacity-40">{sent ? <Check className="size-4" /> : null}{sending ? 'Enviando…' : sent ? 'Enviado' : 'Guardar todo y enviar'}</button></div>
        </section>

        <aside className="flex min-w-[380px] flex-[0.85] flex-col bg-slate-100"><div className="flex h-12 shrink-0 items-center gap-1 border-b bg-card px-3"><button className="viewer-button"><Plus /></button><button className="viewer-button"><ZoomOut /></button><button className="viewer-button"><ArrowLeft /></button><button className="viewer-button"><ArrowRight /></button><button className="viewer-button"><Move /></button><button className="viewer-button"><Undo2 /></button><button className="viewer-button"><Redo2 /></button><div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><span>1 / 1</span><button className="viewer-button"><Maximize2 /></button></div></div><div className="min-h-0 flex-1 overflow-auto p-8">{selected.fileUrl ? (selected.fileType === 'application/pdf' || selected.fileType === 'text/html' || selected.fileType === 'text/plain' ? <iframe title={`Documento ${selected.fileName}`} src={selected.fileUrl} sandbox={selected.fileType === 'text/html' ? '' : undefined} className="h-full min-h-[720px] w-full rounded bg-white shadow-sm" /> : <div className="flex min-h-[720px] items-start justify-center rounded bg-white p-5 shadow-sm"><img src={selected.fileUrl} alt={`Factura cargada ${selected.fileName}`} className="max-h-[850px] max-w-full object-contain" /></div>) : <div className="mx-auto flex min-h-[720px] max-w-[620px] flex-col items-center justify-center gap-3 rounded bg-white p-12 text-center shadow-sm"><FileText className="size-10 text-slate-300" /><p className="text-sm font-medium text-slate-600">Sin documento para mostrar</p><p className="text-xs text-slate-400">Subí una factura para verla acá junto a los datos extraídos.</p></div>}</div></aside>
      </div>

      {arrival ? (
        <button
          type="button"
          onClick={() => {
            setSelectedId(arrival.id)
            setSaved(false)
            setArrival(null)
          }}
          className="fixed right-5 top-16 z-50 flex w-80 items-start gap-3 rounded-lg border border-emerald-200 bg-white p-3 text-left shadow-lg animate-in fade-in slide-in-from-right-4"
        >
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Mail className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-emerald-800">Nueva factura recibida</span>
            <span className="block truncate text-xs text-slate-600">{arrival.supplier}</span>
            {arrival.remitente ? (
              <span className="block truncate text-[11px] text-slate-400">de {arrival.remitente}</span>
            ) : null}
          </span>
          <span className="text-sm leading-none text-slate-400">×</span>
        </button>
      ) : null}
    </main>
  )
}
