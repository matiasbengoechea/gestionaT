import { NextResponse } from "next/server";
import { listInvoices, storageBackend } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista las facturas guardadas.
 *
 * `?since=<ISO>` devuelve solo las recibidas desde ese momento, para que la
 * pantalla pueda refrescarse en vivo sin volver a pedir todo el historial.
 */
export async function GET(request: Request) {
  const since = new URL(request.url).searchParams.get("since") ?? undefined;
  const { invoices, error } = await listInvoices(100, since);
  return NextResponse.json({ ok: true, backend: storageBackend(), invoices, error });
}
