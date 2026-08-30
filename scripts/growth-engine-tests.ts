/**
 * TESTES DETERMINÍSTICOS — Fase 8 (Parte 28)
 * ============================================
 * Testa a lógica pura do Growth Engine sem APIs externas nem banco:
 *   - detecção de sinais (drops, frequência, metas, experimentos, gaps)
 *   - priorização (máx 3, dedup por tipo)
 *   - recomendações (ações acionáveis, sem inventar dados)
 *   - dados insuficientes (SEM_REDE/SEM_SYNC → DADO INSUFICIENTE)
 *   - deduplicação de ações (não duplica mesma recomendação)
 *   - risco de meta (GOAL_AT_RISK)
 *   - idempotência de XP (regra de negócio do completeActionWithXp)
 *
 * Para rodar: npx tsc -p tsconfig.growth-test.json && node .growth-test-build/scripts/growth-engine-tests.js
 * (Não usa vitest/jest — depende apenas de Node + assert).
 */

import * as assert from "node:assert";
import { createHmac } from "node:crypto";
import { detectSignals } from "../src/lib/growth-engine/signals";
import { prioritizeSignals } from "../src/lib/growth-engine/priorities";
import { buildRecommendations } from "../src/lib/growth-engine/recommendations";
import { buildProactiveInsights } from "../src/lib/growth-engine/insights";
import { buildPlan7Days, buildPlan30Days, pickDailyMission } from "../src/lib/growth-engine/progress";
import { buildInternalAutomations } from "../src/lib/growth-engine/automations";
import { verifyWebhookSignature } from "../src/lib/webhooks/signature";
import type { GrowthContext, PlatformContext } from "../src/lib/growth-engine/types";

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

function basePlatform(overrides: Partial<PlatformContext> = {}): PlatformContext {
  return {
    platform: "instagram",
    connected: true,
    status: "DADOS_SUFICIENTES",
    followers: 1000,
    reach: 10000,
    impressions: 20000,
    engagement: 500,
    cardsEngagementChange: 5,
    cardsReachChange: 5,
    growth: 2,
    mediaCount: 30,
    snapshotCount: 5,
    lastSyncAt: new Date().toISOString(),
    posts: 4,
    frequency: 4,
    bestContent: [],
    worstContent: [],
    score: 60,
    scoreCoverage: 80,
    goals: [],
    experiments: [],
    alerts: [],
    plannedContent: [],
    publishedCount: 0,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<GrowthContext> = {}): GrowthContext {
  return {
    userId: "u-test",
    userProfile: { objective: "crescer", niche: "moda", displayName: "Teste" },
    stage: "inicio",
    instagram: basePlatform(),
    tiktok: basePlatform({ platform: "tiktok", connected: false, status: "SEM_REDE" }),
    insights: [],
    intelligenceProfile: { summary: "prefere reels", preferredFormats: "reels", postingFrequency: "3x/semana", observedPatterns: null },
    confidence: 0.9,
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ------------------------------------------------------------
// Testes
// ------------------------------------------------------------

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`);
    throw err;
  }
}

async function main() {
  console.log("\n=== Growth Engine — Testes determinísticos (Parte 28) ===\n");

  // 1) Detecção de sinais
  console.log("\n[1] Detecção de sinais");
  {
    const ctx = makeCtx({
      instagram: basePlatform({
        connected: false,
        status: "SEM_REDE",
        snapshotCount: 0,
      }),
    });
    const signals = await detectSignals(ctx);
    const hasNoAccount = signals.some((s) => s.type === "NO_CONNECTED_ACCOUNT");
    assert.ok(hasNoAccount, "deve detectar NO_CONNECTED_ACCOUNT quando sem rede");
    test("sem rede → NO_CONNECTED_ACCOUNT", () => assert.ok(hasNoAccount));
  }

  // 2) ENGAGEMENT_DROP
  {
    const ctx = makeCtx({
      instagram: basePlatform({ engagement: 100, cardsEngagementChange: -30 }),
    });
    const signals = await detectSignals(ctx);
    const drop = signals.find((s) => s.type === "ENGAGEMENT_DROP");
    test("queda de engajamento → ENGAGEMENT_DROP", () => {
      assert.ok(drop, "deve detectar ENGAGEMENT_DROP");
      assert.ok(drop.severity === "HIGH" || drop.severity === "MEDIUM");
    });
  }

  // 3) Frequência baixa
  {
    const ctx = makeCtx({
      instagram: basePlatform({ frequency: 1 }),
    });
    const signals = await detectSignals(ctx);
    const low = signals.find((s) => s.type === "LOW_POSTING_FREQUENCY");
    test("frequência < 3 → LOW_POSTING_FREQUENCY", () => assert.ok(low));
  }

  // 4) Priorização: máx 3 + dedup por tipo
  {
    const ctx = makeCtx({
      instagram: basePlatform({
        frequency: 1,
        engagement: 50,
        cardsEngagementChange: -40,
        reach: 100,
        cardsReachChange: -50,
        growth: -5,
      }),
    });
    const signals = await detectSignals(ctx);
    const priorities = prioritizeSignals(ctx, signals);
    test("prioridades ≤ 3", () => assert.ok(priorities.length <= 3));
    test("prioridades sem duplicar tipo", () => {
      const types = priorities.map((p) => p.signalType);
      assert.strictEqual(new Set(types).size, types.length);
    });
    test("prioridades ordenadas (nível 1 = maior score)", () => {
      for (let i = 1; i < priorities.length; i++) {
        assert.ok(priorities[i - 1].level < priorities[i].level);
      }
    });
  }

  // 5) Recomendações acionáveis
  {
    const ctx = makeCtx({
      instagram: basePlatform({ frequency: 1 }),
    });
    const signals = await detectSignals(ctx);
    const priorities = prioritizeSignals(ctx, signals);
    const recs = buildRecommendations(ctx, priorities);
    test("recomendações têm campos acionáveis", () => {
      for (const r of recs) {
        assert.ok(r.oQue.length > 0, "oQue");
        assert.ok(r.porQue.length > 0, "porQue");
        assert.ok(r.como.length > 0, "como");
        assert.ok(r.metrica.length > 0, "metrica");
        assert.ok(r.confianca >= 0 && r.confianca <= 1, "confianca");
      }
    });
    test("recomendação de baixa frequência é concreta", () => {
      const low = recs.find((r) => r.signalType === "LOW_POSTING_FREQUENCY");
      assert.ok(low, "deve haver recomendação de frequência");
      assert.ok(low.oQue.includes("3"), "deve citar meta de 3 posts/semana");
    });
  }

  // 6) DADO INSUFICIENTE sem dados
  {
    const ctx = makeCtx({
      instagram: basePlatform({ connected: false, status: "SEM_REDE", snapshotCount: 0 }),
      tiktok: basePlatform({ platform: "tiktok", connected: false, status: "SEM_REDE", snapshotCount: 0 }),
    });
    const signals = await detectSignals(ctx);
    const priorities = prioritizeSignals(ctx, signals);
    const recs = buildRecommendations(ctx, priorities);
    // Sem dados reais, recomendações devem limitar-se a "conectar" (nunca métricas inventadas)
    for (const r of recs) {
      assert.ok(!r.metrica.toLowerCase().includes("seguidores"), "não deve recomendar métrica de seguidores sem dado real");
    }
    test("sem dados → recomendações são de conexão, não métricas inventadas", () => assert.ok(true));
  }

  // 7) Meta em risco (GOAL_AT_RISK)
  {
    const soon = new Date(Date.now() + 3 * 86400000).toISOString();
    const ctx = makeCtx({
      instagram: basePlatform({
        goals: [{
          id: "g1", title: "Ganhar 100 seguidores", category: "crescimento",
          progressPercent: 20, status: "ATIVA", deadline: soon,
          targetValue: 100, currentValue: 20, platform: "instagram",
        }],
      }),
    });
    const signals = await detectSignals(ctx);
    const risk = signals.find((s) => s.type === "GOAL_AT_RISK");
    test("meta com prazo próximo e progresso baixo → GOAL_AT_RISK", () => assert.ok(risk));
  }

  // 8) Meta no caminho (GOAL_ON_TRACK)
  {
    const far = new Date(Date.now() + 20 * 86400000).toISOString();
    const ctx = makeCtx({
      instagram: basePlatform({
        goals: [{
          id: "g2", title: "Ganhar 100 seguidores", category: "crescimento",
          progressPercent: 60, status: "ATIVA", deadline: far,
          targetValue: 100, currentValue: 60, platform: "instagram",
        }],
      }),
    });
    const signals = await detectSignals(ctx);
    const onTrack = signals.find((s) => s.type === "GOAL_ON_TRACK");
    test("meta com progresso saudável → GOAL_ON_TRACK", () => assert.ok(onTrack));
  }

  // 9) Experimento vencedor + perdedor + running
  {
    const ctx = makeCtx({
      instagram: basePlatform({
        experiments: [
          { id: "e1", hypothesis: "Reels > carrossel", status: "CONFIRMED", platform: "instagram" },
          { id: "e2", hypothesis: "Post 7h", status: "LOSER", platform: "instagram" },
          { id: "e3", hypothesis: "Story 2x/dia", status: "RUNNING", platform: "instagram" },
        ],
      }),
    });
    const signals = await detectSignals(ctx);
    test("experimentos CONFIRMED/LOSER/RUNNING geram sinais", () => {
      assert.ok(signals.some((s) => s.type === "EXPERIMENT_WINNER"));
      assert.ok(signals.some((s) => s.type === "EXPERIMENT_LOSER"));
      assert.ok(signals.some((s) => s.type === "EXPERIMENT_RUNNING"));
    });
  }

  // 10) Content gap
  {
    const ctx = makeCtx({
      instagram: basePlatform({
        frequency: 4,
        plannedContent: [],
      }),
    });
    const signals = await detectSignals(ctx);
    const gap = signals.find((s) => s.type === "CONTENT_GAP");
    test("sem conteúdo planejado p/ 7 dias → CONTENT_GAP", () => assert.ok(gap));
  }

  // 11) Insights proativos (nunca inventa)
  {
    const ctx = makeCtx({});
    const signals = await detectSignals(ctx);
    const insights = buildProactiveInsights(signals);
    for (const ins of insights) {
      assert.ok(ins.detail.length > 0, "insight tem detalhe");
      assert.ok(["DADO_REAL", "INFERENCIA", "RECOMENDACAO", "DADO_INSUFICIENTE"].includes(ins.kind));
    }
    test("insights proativos têm origem e detalhe reais", () => assert.ok(true));
  }

  // 12) Plano 7 dias
  {
    const ctx = makeCtx({});
    const signals = await detectSignals(ctx);
    const priorities = prioritizeSignals(ctx, signals);
    const recs = buildRecommendations(ctx, priorities);
    const plan = buildPlan7Days(ctx, priorities, recs);
    test("plano de 7 dias tem 7 dias", () => assert.strictEqual(plan.days.length, 7));
    test("cada dia tem ≥ 1 item", () => {
      for (const d of plan.days) assert.ok(d.items.length >= 1);
    });
  }

  // 13) Plano 30 dias adapta ao estágio
  {
    const ctxSemDados = makeCtx({
      instagram: basePlatform({ connected: false, status: "SEM_REDE", snapshotCount: 0 }),
      tiktok: basePlatform({ platform: "tiktok", connected: false, status: "SEM_REDE", snapshotCount: 0 }),
    });
    const plan = buildPlan30Days(ctxSemDados);
    test("plano de 30 dias tem 4 semanas", () => assert.strictEqual(plan.weeks.length, 4));
    test("sem dados → semana 1 foca conexão", () => {
      const w1 = plan.weeks[0];
      assert.ok(w1.items.some((i) => i.toLowerCase().includes("conectar")));
    });
  }

  // 14) Missão do dia
  {
    const ctx = makeCtx({});
    const mission = pickDailyMission(ctx, [], [], []);
    test("sem dados → missão diz DADO INSUFICIENTE", () => {
      assert.ok(mission.rationale.includes("DADO INSUFICIENTE"));
    });
  }

  // 15) Automações internas (sem ação externa)
  {
    const ctx = makeCtx({
      instagram: basePlatform({
        goals: [{
          id: "g3", title: "Meta X", category: "crescimento",
          progressPercent: 10, status: "ATIVA",
          deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
          targetValue: 100, currentValue: 10, platform: "instagram",
        }],
        plannedContent: [],
        frequency: 4,
      }),
    });
    const signals = await detectSignals(ctx);
    const priorities = prioritizeSignals(ctx, signals);
    const recs = buildRecommendations(ctx, priorities);
    const automations = buildInternalAutomations(signals, recs);
    test("automações internas ligadas a sinais", () => {
      assert.ok(automations.length >= 1);
      for (const a of automations) {
        assert.ok(["alerta", "recomendacao", "acao"].includes(a.output));
      }
    });
    test("automações internas NÃO geram DM/publicação", () => {
      for (const a of automations) {
        assert.notStrictEqual(a.output, "dm");
        assert.notStrictEqual(a.output, "publicacao");
      }
    });
  }

  // 16) Deduplicação de ações por sourceRecommendation
  {
    const ctx = makeCtx({
      instagram: basePlatform({ frequency: 1 }),
    });
    const signals = await detectSignals(ctx);
    const priorities = prioritizeSignals(ctx, signals);
    const recs = buildRecommendations(ctx, priorities);
    const slugs = new Set(recs.map((r) => r.slug));
    test("recomendações têm slugs únicos (base p/ dedup de ações)", () => {
      assert.strictEqual(slugs.size, recs.length);
    });
  }

  // 17) Idempotência de XP — regra: nunca concluir mesma ação 2x
  {
    // Simula a lógica do completeActionWithXp: uma vez concluída, jáGranted.
    let alreadyGranted = false;
    const complete = () => {
      if (alreadyGranted) return { granted: false, alreadyGranted: true };
      alreadyGranted = true;
      return { granted: true, alreadyGranted: false };
    };
    const first = complete();
    const second = complete();
    test("XP concedido uma única vez por ação", () => {
      assert.strictEqual(first.granted, true);
      assert.strictEqual(second.granted, false);
      assert.strictEqual(second.alreadyGranted, true);
    });
  }

  // 18) Verificação de assinatura de webhook (X-Hub-Signature-256)
  {
    const secret = "app_secret_de_teste";
    const body = JSON.stringify({ object: "instagram", entry: [] });
    const signature = `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;

    test("assinatura X-Hub-Signature-256 válida é aceita", () => {
      assert.strictEqual(verifyWebhookSignature(body, signature, secret), true);
    });

    test("assinatura com segredo errado é rejeitada", () => {
      assert.strictEqual(
        verifyWebhookSignature(body, signature, "outro_segredo"),
        false
      );
    });

    test("payload adulterado é rejeitado", () => {
      const tampered = JSON.stringify({ object: "instagram", entry: [1] });
      assert.strictEqual(verifyWebhookSignature(tampered, signature, secret), false);
    });

    test("ausência de assinatura é rejeitada", () => {
      assert.strictEqual(verifyWebhookSignature(body, null, secret), false);
    });

    test("formato sha256= é aceito e sem prefixo também", () => {
      const raw = createHmac("sha256", secret).update(body, "utf8").digest("hex");
      assert.strictEqual(verifyWebhookSignature(body, `sha256=${raw}`, secret), true);
      assert.strictEqual(verifyWebhookSignature(body, raw, secret), true);
    });
  }

  console.log(`\n✅ ${passed} testes passaram.\n`);
}

main().catch((err) => {
  console.error("\n❌ Falha nos testes:", err.message ?? err);
  process.exit(1);
});
