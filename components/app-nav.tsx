'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, FileScan, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Facturas', icon: FileScan },
  { href: '/libro-iva', label: 'Libro IVA', icon: Receipt },
  { href: '/libro-diario', label: 'Libro Diario', icon: BookOpen },
]

export function AppNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Principal"
      className="flex h-11 shrink-0 items-center gap-6 border-b bg-card px-5"
    >
      <span className="text-sm font-bold tracking-tight">GestionaT</span>
      <ul className="flex items-center gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
