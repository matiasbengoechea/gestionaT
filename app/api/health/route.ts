import { NextResponse } from "next/server";
import { resolveProvider } from "@/lib/ai";

export const runtime = "nodejs";

/** Commit deployado, para verificar qué versión está sirviendo Vercel. */
function deployedCommit(): string | null {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : null;
}

export async function GET() {
  try {
    const { provider, model } = resolveProvider();
    return NextResponse.json({ ok: true, provider, model, commit: deployedCommit() });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        provider: null,
        model: null,
        commit: deployedCommit(),
        error:
          "No hay API key de IA configurada. Definí OPENROUTER_API_KEY, GEMINI_API_KEY u OPENAI_API_KEY.",
      },
      { status: 503 },
    );
  }
}
