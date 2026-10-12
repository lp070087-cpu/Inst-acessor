import { NextResponse } from "next/server";

import {
  createRateLimiter,
  clientIp,
} from "@/lib/publishing/rate-limit";
import { joinWaitlistSchema } from "@/lib/validators/waitlist";
import { joinWaitlist, waitlistAvailable } from "@/lib/billing/waitlist-db";
import { normalizeEmail } from "@/lib/first-access/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Rate limit por IP (anti-flood) + por e-mail (anti-spam do mesmo endereço).
const waitlistIpLimiter = createRateLimiter({ windowMs: 60_000, max: 8 });
const waitlistEmailLimiter = createRateLimiter({ windowMs: 60_000, max: 3 });

/**
 * POST /api/billing/waitlist — entrada PÚBLICA na lista de espera
 * =================================================================
 * Chamada pelo checkout (/checkout) quando não há vaga. NÃO toca a landing.
 *
 * - Validação zod + consentimento EXPLÍCITO (checkbox).
 * - Idempotente por e-mail normalizado: entrar duas vezes não cria duplicata
 *   (devolve `created: false` para a UI não fingir um cadastro novo).
 * - NUNCA revela se um e-mail já estava na lista de outra forma que a própria
 *   resposta direta ao próprio interessado.
 */
export async function POST(request: Request) {
  if (!waitlistIpLimiter.check(clientIp(request))) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um instante e tente novamente." },
      { status: 429 }
    );
  }

  if (!waitlistAvailable()) {
    // Modelo ausente (migration não aplicada) → estado honesto, não 500.
    return NextResponse.json(
      { error: "Lista de espera indisponível no momento." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const parsed = joinWaitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const normalized = normalizeEmail(parsed.data.email);
  if (!normalized) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  // Rate limit por e-mail normalizado (não dá para contornar com variações).
  if (!waitlistEmailLimiter.check(`wl:${normalized}`)) {
    return NextResponse.json(
      { error: "Você já entrou na lista há instantes. Aguarde um pouco." },
      { status: 429 }
    );
  }

  try {
    const { created } = await joinWaitlist({
      name: parsed.data.name ?? null,
      email: normalized,
      notes: parsed.data.planSlug ? `Interesse: ${parsed.data.planSlug}` : null,
    });

    return NextResponse.json({
      ok: true,
      created,
      message: created
        ? "Você entrou na lista de espera. Avisaremos por e-mail assim que abrir uma vaga."
        : "Você já está na lista de espera. Avisaremos por e-mail assim que abrir uma vaga.",
    });
  } catch {
    console.error("[waitlist] falha ao entrar na lista de espera");
    return NextResponse.json(
      { error: "Não foi possível entrar na lista agora. Tente novamente." },
      { status: 500 }
    );
  }
}
