import { NextResponse } from "next/server";
import { resolveFx } from "@/lib/fx";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Diagnóstico de cotizaciones.
 * Ejemplo: /api/fx?moneda=USD&fecha=2019-02-11
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const moneda = url.searchParams.get("moneda") ?? "USD";
  const fecha = url.searchParams.get("fecha") ?? new Date().toISOString().slice(0, 10);

  const { quote, reason } = await resolveFx(moneda, fecha);

  if (!quote) {
    return NextResponse.json(
      { ok: false, moneda, fecha, error: reason ?? "cotización no disponible" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, moneda, fecha, quote });
}
