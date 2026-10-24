import { Download, Info } from 'lucide-react'

export const money = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

export function BookHeader({
  title,
  period,
  company,
}: {
  title: string
  period: string
  company: string
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-balance">{title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {company} · {period}
          </p>
        </div>
        <button
          type="button"
          disabled
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-60"
        >
          <Download className="size-4" aria-hidden="true" />
          Exportar
        </button>
      </div>
      <p className="flex items-center gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        Vista de ejemplo con datos ficticios. Muestra cómo quedaría la salida una vez aprobadas las facturas.
      </p>
    </header>
  )
}
