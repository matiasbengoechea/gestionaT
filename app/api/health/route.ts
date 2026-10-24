import { NextResponse } from "next/server";
import { resolveProvider } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { provider, model } = resolveProvider();
    return NextResponse.json({ ok: true, provider, model });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        provider: null,
        model: null,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo resolver el proveedor de IA.",
      },
      { status: 503 },
    );
  }
}
