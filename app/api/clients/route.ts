import { NextResponse } from "next/server";
import { CLIENTS } from "@/lib/clients";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, clients: CLIENTS });
}
