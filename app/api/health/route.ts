import { NextResponse } from "next/server";
import { resolveProvider } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { provider, model } = resolveProvider();
    return NextResponse.json({ ok: true, provider, model });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        provider: null,
        model: null,
        error:
          "No hay API key de IA configurada. Definí GEMINI_API_KEY u OPENAI_API_KEY.",
      },
      { status: 503 },
    );
  }
}
