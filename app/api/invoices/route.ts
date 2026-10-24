import { NextResponse } from "next/server";
import { listInvoices, storageBackend } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const invoices = await listInvoices();
  return NextResponse.json({ ok: true, backend: storageBackend(), invoices });
}
