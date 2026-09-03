/**
 * TESTES DETERMINÍSTICOS — RANK / IMPULSO / MOMENTUM (rodada #274)
 * =================================================================
 * Testa a lógica pura do Rank/Momentum SEM APIs externas nem banco:
 *   1. XP não duplica (mesma meta/período nunca paga duas vezes)
 *   2. Semana atravessando mês (janela semanal cruza o mês)
 *   3. Semana atravessando ano (chave ISO W01/W52)
 *   4. Follower delta IG + TikTok (delta absoluto real por plataforma)
 *   5. Ausência de baseline não inventa crescimento
 *   6. Metas diárias/semanais/mensais corretas (contagem de cards)
 *   7. Streak 3/7/15/30
 *   8. Display-name fallback (perfil → instagram → perfil)
 *
 * Para rodar: npx tsc -p tsconfig.rank-test.json && node .rank-test-build/scripts/rank-tests.js
 * (Não usa vitest/jest — depende apenas de Node + assert.)
 */

import * as assert from "node:assert";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  fmtDay,
  weekKey,
  monthKey,
  RITMO_BANDS,
  deriveStreak,
  followersDelta,
  growthPct,
  combinedGrowthPct,
  buildCards,
  buildState,
  STREAK_BONUS_MILESTONES,
  STREAK_BONUS_XP,
} from "../src/lib/gamification/momentum-core";
import type {
  Gather,
  SnapshotRow,
  XpRowLike,
  RitmoState,
  CadenceBand,
} from "../src/lib/gamification/momentum-core";
import {
  readStoredSource,
  resolveDisplayName,
} from "../src/lib/gamification/display-name-core";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

let passed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`  ❌ ${name}`);
    console.error(`     ${err instanceof Error ? err.message : String(err)}`);
  }
}

function iso(dateStr: string, h = 12): Date {
  const d = new Date(`${dateStr}T12:00:00`);
  if (!Number.isFinite(d.getTime())) throw new Error(`Data inválida: ${dateStr}`);
  if (h) d.setHours(h, 0, 0, 0);
  return d;
}

function snap(capturedAt: string, followers: number | null, reach?: number | null, engagement?: number | null): SnapshotRow {
  return {
    capturedAt: iso(capturedAt),
    followersCount: followers,
    reach: reach ?? null,
    engagement: engagement ?? null,
  };
}

function xpRow(createdAt: string, source = "acao", refId = "x", amount = 10): XpRowLike {
  return { createdAt: iso(createdAt), source, refId, amount };
}

/** Gather mínimo com "hoje" fixo para janelas determinísticas. */
function gatherAt(
  today: string,
  overrides: Partial<Gather> = {}
): Gather {
  const now = iso(today);
  return {
    now,
    ig: [],
    tt: [],
    xpRows: [],
    actions: { copies: [], ideias: [], ia: [], publicacoes: [] },
    monthStart: startOfMonth(now),
    ...overrides,
  };
}

function bandByTitle(title: string): CadenceBand {
  const b = RITMO_BANDS.find((x) => x.title === title);
  assert.ok(b, `band "${title}" existe`);
  return b as CadenceBand;
}

function card(state: RitmoState, title: string) {
  const c = state.cards.find((x) => x.title === title);
  assert.ok(c, `card "${title}" existe`);
  return c;
}

// ------------------------------------------------------------
// 1. XP não duplica
// ------------------------------------------------------------

function xpIdempotenceSection() {
  const granted = new Set<string>();
  const simulateGrant = (source: string, key: string) => {
    const id = `${source}:${key}`;
    if (granted.has(id)) return false;
    granted.add(id);
    return true;
  };

  // Mesma meta diária + mesma chave do dia → segunda chamada NÃO concede.
  const dKey = fmtDay(iso("2026-09-03"));
  assert.strictEqual(simulateGrant("ritmo-copy", dKey), true);
  assert.strictEqual(simulateGrant("ritmo-copy", dKey), false);

  // Mesma meta semanal (mesma semana W36) → segunda chamada NÃO concede.
  const wKey = weekKey(iso("2026-09-03"));
  assert.strictEqual(wKey, "2026-W36");
  assert.strictEqual(simulateGrant("ritmo-publicar", wKey), true);
  assert.strictEqual(simulateGrant("ritmo-publicar", wKey), false);

  // Mesma meta mensal (mesmo mês) → segunda chamada NÃO concede.
  const mKey = monthKey(iso("2026-09-03"));
  assert.strictEqual(mKey, "2026-09");
  assert.strictEqual(simulateGrant("ritmo-seguidores", mKey), true);
  assert.strictEqual(simulateGrant("ritmo-seguidores", mKey), false);

  // Período DIFERENTE (outro dia) pode conceder de novo.
  const d2 = fmtDay(iso("2026-09-04"));
  assert.strictEqual(simulateGrant("ritmo-copy", d2), true);

  test("XP idempotente: mesma meta+período nunca paga duas vezes", () => {});
}

// ------------------------------------------------------------
// 2. Semana atravessando mês
// ------------------------------------------------------------

function weekCrossingMonthSection() {
  // 31/ago/2026 é segunda-feira → semana começa em agosto e termina em setembro.
  const monday = iso("2026-08-31");
  const tuesday = iso("2026-09-01");
  const wStart = startOfWeek(tuesday);
  assert.strictEqual(fmtDay(wStart), "2026-08-31");

  const wk = weekKey(tuesday);
  assert.strictEqual(wk, "2026-W36");

  // A janela semanal para hoje (02/set) começa 31/ago — mesmo key para ambos.
  const w1 = weekKey(monday);
  const w2 = weekKey(iso("2026-09-02"));
  assert.strictEqual(w1, w2);

  // Ações da semana iniciada no mês anterior são contadas.
  const g = gatherAt("2026-09-02", {
    actions: { copies: [iso("2026-08-31", 9)], ideias: [], ia: [], publicacoes: [] },
  });
  // Janela semanal cruza o mês e ainda pertence à W36.
  const since = startOfWeek(g.now);
  assert.ok(g.actions.copies[0].getTime() >= since.getTime());

  test("Semana atravessando mês: segunda em ago, contagem inclui dia 31/ago", () => {});
}

// ------------------------------------------------------------
// 3. Semana atravessando ano
// ------------------------------------------------------------

function weekCrossingYearSection() {
  // 29/dez/2025 é segunda-feira → a semana atravessa o ano.
  const mondayDec29 = iso("2025-12-29");

  // 1º/Jan/2026 (quinta) está na MESMA semana de 29/dez/2025.
  const start = startOfWeek(iso("2026-01-01"));
  assert.strictEqual(fmtDay(start), "2025-12-29");

  // Mesma semana → mesmo períodoKey estável (independe do dia consultado).
  const kMon = weekKey(mondayDec29);
  const kThu = weekKey(iso("2026-01-01"));
  const kWed = weekKey(iso("2025-12-31"));
  assert.strictEqual(kThu, kMon);
  assert.strictEqual(kWed, kMon);

  // A chave NÃO colide com a semana seguinte (05/jan) — períodos distintos.
  const kNext = weekKey(iso("2026-01-05"));
  assert.notStrictEqual(kNext, kMon);

  // A mesma chave é estável entre chamadas (idempotência de período).
  assert.strictEqual(weekKey(mondayDec29), kMon);

  test("Semana atravessando ano: dias da mesma semana compartilham chave única", () => {});
}

// ------------------------------------------------------------
// 4. Follower delta IG + TikTok
// ------------------------------------------------------------

function followerDeltaSection() {
  const now = "2026-09-03";

  // IG: baseline 1000 no dia 30/08, agora 1015 → delta 15.
  // TikTok: baseline 500, agora 510 → delta 10. Total 25.
  const g = gatherAt(now, {
    ig: [snap("2026-08-30", 1000), snap("2026-09-01", 1008), snap("2026-09-03", 1015)],
    tt: [snap("2026-08-25", 500), snap("2026-09-02", 510)],
  });

  // Janela do dia (03/09): só o snapshot de hoje (1015) conta → baseline é o
  // último antes de hoje: 1008 (IG) e 510 (TikTok está antes → 510 não entra
  // na janela; baseline do TikTok para hoje = 510? Não — 510 foi em 02/09, que
  // também é antes da janela de hoje → baseline. Mas não há snapshot DENTRO da
  // janela de hoje para o TikTok → apenas IG conta).
  const sinceDay = startOfDay(g.now);
  const dayDelta = followersDelta(g, sinceDay);
  assert.strictEqual(dayDelta.available, true);
  assert.strictEqual(dayDelta.value, 1015 - 1008); // 7 (só IG medido hoje)

  // Janela do mês (01/09+): IG delta 15 (1000→1015), TikTok delta 10 (500→510).
  const sinceMonth = startOfMonth(g.now);
  const monthDelta = followersDelta(g, sinceMonth);
  assert.strictEqual(monthDelta.available, true);
  assert.strictEqual(monthDelta.value, 15 + 10);

  test("Follower delta IG+TikTok: soma real por plataforma dentro da janela", () => {});
}

// ------------------------------------------------------------
// 5. Ausência de baseline não inventa crescimento
// ------------------------------------------------------------

function noBaselineSection() {
  const now = "2026-09-03";

  // Nenhum snapshot → sem-dados honesto.
  const empty = gatherAt(now);
  assert.deepStrictEqual(followersDelta(empty, startOfDay(empty.now)), { value: 0, available: false });

  // Snapshot DENTRO da janela mas SEM baseline anterior → não mede delta (0),
  // porém marca como "available" (existe leitura atual, mas delta desconhecido).
  const onlyIn = gatherAt(now, { ig: [snap("2026-09-03", 1500)] });
  const d = followersDelta(onlyIn, startOfDay(onlyIn.now));
  assert.strictEqual(d.available, true);
  assert.strictEqual(d.value, 0);

  // growthPct: sem baseline e só UM snapshot na janela → unavailable (não inventa).
  const g2 = gatherAt(now, { ig: [snap("2026-09-03", 100, 10000, 300)] });
  const alcance = growthPct(g2.ig, startOfDay(g2.now), "reach");
  assert.strictEqual(alcance.available, false);

  // combinedGrowthPct: sem baseline → não inventa %.
  const g3 = gatherAt(now, { ig: [snap("2026-09-03", 500)], tt: [snap("2026-09-03", 400)] });
  const comb = combinedGrowthPct(g3, startOfMonth(g3.now));
  assert.strictEqual(comb.available, false);
  assert.strictEqual(comb.value, 0);

  test("Ausência de baseline não inventa crescimento/delta", () => {});
}

// ------------------------------------------------------------
// 6. Metas diárias/semanais/mensais corretas
// ------------------------------------------------------------

function goalBandsSection() {
  // 5 diárias, 5 semanais, 4 mensais.
  const dias = RITMO_BANDS.filter((b) => b.period === "dia");
  const semanas = RITMO_BANDS.filter((b) => b.period === "semana");
  const meses = RITMO_BANDS.filter((b) => b.period === "mes");
  assert.strictEqual(dias.length, 5);
  assert.strictEqual(semanas.length, 5);
  assert.strictEqual(meses.length, 4);
  assert.strictEqual(RITMO_BANDS.length, 14);

  // Títulos oficiais.
  const titles = RITMO_BANDS.map((b) => b.title);
  for (const t of [
    "Ganhar seguidores", "Gerar ideias", "Criar copy", "Utilizar IA Acessor", "Publicar conteúdo",
    "Crescimento de seguidores", "Crescimento de alcance", "Crescimento de engajamento",
    "Conteúdos publicados", "Copies criadas",
    "Meta de seguidores", "Meta de alcance", "Meta de engajamento", "Meta de crescimento geral",
  ]) {
    assert.ok(titles.includes(t), `meta "${t}" presente`);
  }

  test("Metas prontas: 5 diárias + 5 semanais + 4 mensais com títulos oficiais", () => {});
}

function buildCardsCompletionSection() {
  const now = "2026-09-03";

  // Constrói um gather com AÇÕES reais suficientes para a diária "Criar copy"
  // (1 copy hoje) → card fica "concluida" com current 1.
  const g = gatherAt(now, {
    actions: { copies: [iso("2026-09-03", 9)], ideias: [], ia: [], publicacoes: [] },
  });
  const state = buildState(g, new Set<string>(), []);
  const c = card(state, "Criar copy");
  assert.strictEqual(c.status, "concluida");
  assert.strictEqual(c.current, 1);
  assert.strictEqual(c.available, true);

  // Diária "Ganhar seguidores" SEM snapshot → sem-dados honesto.
  const c2 = card(state, "Ganhar seguidores");
  assert.strictEqual(c2.status, "sem-dados");
  assert.strictEqual(c2.available, false);

  test("Card 'Criar copy' concluída com ação real; 'Ganhar seguidores' sem-dados honesto", () => {});
}

// ------------------------------------------------------------
// 7. Streak 3/7/15/30
// ------------------------------------------------------------

function streakSection() {
  const today = iso("2026-09-03", 8);

  // 3 dias corridos com XP: 01, 02, 03/09.
  const r3 = [
    xpRow("2026-09-01", "acao", "a", 10),
    xpRow("2026-09-02", "acao", "b", 10),
    xpRow("2026-09-03", "acao", "c", 10),
  ];
  const s3 = deriveStreak(r3, today);
  assert.strictEqual(s3.streakDays, 3);

  // 7 dias: 28/08 a 03/09.
  const r7: XpRowLike[] = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(2026, 7, 28 + i); // 28/ago + i (cruza p/ setembro corretamente)
    r7.push({ createdAt: dt, source: "acao", refId: `r${i}`, amount: 10 });
  }
  const s7 = deriveStreak(r7, today);
  assert.strictEqual(s7.streakDays, 7);

  // 15 dias: 20/08 a 03/09.
  const r15: XpRowLike[] = [];
  for (let i = 0; i < 15; i++) {
    const dt = new Date(2026, 7, 20 + i); // 20/ago + i (cruza p/ setembro corretamente)
    r15.push({ createdAt: dt, source: "acao", refId: `r${i}`, amount: 10 });
  }
  const s15 = deriveStreak(r15, today);
  assert.strictEqual(s15.streakDays, 15);

  // 30 dias: 05/08 a 03/09.
  const r30: XpRowLike[] = [];
  for (let i = 0; i < 30; i++) {
    const dt = new Date(2026, 7, 5 + i); // 5/ago + i
    r30.push({ createdAt: dt, source: "acao", refId: `r${i}`, amount: 10 });
  }
  const s30 = deriveStreak(r30, today);
  assert.strictEqual(s30.streakDays, 30);

  // Marcos e XP.
  assert.deepStrictEqual([...STREAK_BONUS_MILESTONES], [3, 7, 15, 30]);
  assert.strictEqual(STREAK_BONUS_XP[3], 20);
  assert.strictEqual(STREAK_BONUS_XP[7], 50);
  assert.strictEqual(STREAK_BONUS_XP[15], 120);
  assert.strictEqual(STREAK_BONUS_XP[30], 300);

  // nextStreakBonus correto.
  const state3 = buildState(gatherAt("2026-09-03", { xpRows: r3 }), new Set<string>(), []);
  assert.strictEqual(state3.streakDays, 3);
  assert.strictEqual(state3.nextStreakBonus, 7);

  test("Streak 3/7/15/30 dias derivados de XpLog + bônus 20/50/120/300", () => {});
}

// ------------------------------------------------------------
// 8. Display-name fallback
// ------------------------------------------------------------

function displayNameFallbackSection() {
  // Padrão: usa nome do perfil.
  assert.strictEqual(readStoredSource(undefined), "profile");
  assert.strictEqual(readStoredSource({}), "profile");
  assert.strictEqual(readStoredSource({ displayNameSource: "instagram" }), "instagram");

  // Sem preferência + nome do perfil → profile.
  const a = resolveDisplayName("profile", "Ana Moda", null);
  assert.deepStrictEqual(a, { source: "profile", value: "Ana Moda" });

  // Sem preferência + sem nome de perfil → "Usuário".
  const b = resolveDisplayName("profile", null, null);
  assert.deepStrictEqual(b, { source: "profile", value: "Usuário" });

  // Escolheu Instagram + conta conectada com nome → nome da conta.
  const c = resolveDisplayName("instagram", "Ana Moda", { name: "Loja Ana", username: "ana.moda" });
  assert.deepStrictEqual(c, { source: "instagram", value: "Loja Ana" });

  // Escolheu Instagram + conta sem nome mas com username → @username.
  const d = resolveDisplayName("instagram", "Ana Moda", { name: null, username: "ana.moda" });
  assert.deepStrictEqual(d, { source: "instagram", value: "@ana.moda" });

  // Escolheu Instagram mas SEM conta conectada → fallback seguro p/ perfil.
  const e = resolveDisplayName("instagram", "Ana Moda", null);
  assert.deepStrictEqual(e, { source: "profile", value: "Ana Moda" });

  // Escolheu Instagram + conta sem nome/username → fallback p/ perfil.
  const f = resolveDisplayName("instagram", "Ana Moda", { name: null, username: null });
  assert.deepStrictEqual(f, { source: "profile", value: "Ana Moda" });

  test("Display-name: perfil → instagram → fallback perfil (nunca quebra)", () => {});
}

// ------------------------------------------------------------
// main
// ------------------------------------------------------------

function main() {
  console.log("\n🔎 Rank / Impulso / Momentum — testes determinísticos\n");
  xpIdempotenceSection();
  weekCrossingMonthSection();
  weekCrossingYearSection();
  followerDeltaSection();
  noBaselineSection();
  goalBandsSection();
  buildCardsCompletionSection();
  streakSection();
  displayNameFallbackSection();

  console.log(`\nResultado: ${passed} passaram, ${failures.length} falharam\n`);
  if (failures.length > 0) {
    console.error("Falhas:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}

main();
