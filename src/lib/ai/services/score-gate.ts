/**
 * REGRA ÚNICA de "posso registrar este Score no histórico?".
 *
 * POR QUE ESTE ARQUIVO EXISTE (item 4)
 * ------------------------------------
 * O botão "Registrar no histórico" estava SEMPRE indisponível em contas reais.
 * O motivo não era o botão: o servidor só publica o Score Geral quando há
 * evidência mínima (3 de 4 pilares, cobertura ≥ 60%, 2+ sincronizações), e a
 * tela — que lia `scoreAvailable` — desabilitava o botão exatamente nos mesmos
 * casos. Sem número não há histórico, e isso está certo. O defeito era o
 * usuário não conseguir saber se o problema era ELE ou o app.
 *
 * A causa do "sem evidência suficiente" era mais concreta: `snapshotCount` vinha
 * de `getDashboardInstagramData()`, que mede quantos dias TÊM snapshot. Como o
 * próprio ato de registrar cria um snapshot, a conta ficava presa em 1 registro
 * e o Score Geral nunca nascia — um ciclo que se alimentava do próprio bloqueio.
 *
 * A correção da contagem vive em `computeScore` (o pilar "Consistência" e o
 * limiar mínimo contam as MESMAS duas fontes: snapshots reais do dashboard e as
 * linhas já registradas em `ProfileScore`). Este módulo é a REGRA, pura e sem
 * dependência de banco, importada pelos DOIS lados — servidor (que grava) e
 * cliente (que decide o que o botão diz) — para que eles nunca discordem.
 *
 * Nada aqui inventa dado: o módulo só responde sim/não e explica o porquê.
 */

export interface ScoreGateScore {
  overall: number | null;
  scoreAvailable?: boolean;
  reason?: string | null;
  measuredPillars?: number;
  totalPillars?: number;
  coverage?: number | null;
}

export type ScoreGateReason =
  | "sem-score"
  | "sem-evidencia"
  | "ja-registrado"
  | "apto";

export interface ScoreGate {
  /** O servidor vai GRAVAR se o POST for feito agora? */
  canPersist: boolean;
  reason: ScoreGateReason;
  /** Texto para o usuário. `null` quando `canPersist` é true (nada a explicar). */
  message: string | null;
  /** Complemento curto e verificável ("2 de 4 pilares · cobertura 50%"). */
  detail: string | null;
}

/**
 * Mensagem padrão quando o servidor não devolve motivo. Mantida aqui para o
 * cliente e o servidor usarem a MESMA frase — antes cada lado tinha a sua.
 */
export const SCORE_NOT_AVAILABLE_FALLBACK =
  "Score ainda não disponível: sem evidência suficiente para uma avaliação confiável.";

/**
 * Já existe um Score DESTE MESMO valor como o último registro desta plataforma?
 *
 * Registrar de novo não acrescenta nada: `getScoreHistory` ordena por
 * `createdAt desc` e o card do Histórico mostra o Top 14 — duas barras idênticas
 * seguidas só poluem. Não é uma proibição do banco (o histórico é append-only),
 * é a mesma decisão que o produto toma em "Atualizar métricas": repetir sem
 * mudança não é progresso.
 */
export function isDuplicateOfLatest(score: ScoreGateScore, history: { overall: number }[]): boolean {
  if (score.overall == null) return false;
  const last = history[0];
  return last != null && last.overall === score.overall;
}

/**
 * A REGRA. `history` é o histórico JÁ carregado da plataforma atual (o cliente
 * tem; o servidor passa vazio porque, ao gravar, a duplicidade não é bloqueio —
 * o POST cria um snapshot novo de propósito).
 */
export function scoreHistoryGate(
  score: ScoreGateScore | null,
  history: { overall: number }[] = []
): ScoreGate {
  if (score == null) {
    return {
      canPersist: false,
      reason: "sem-score",
      message: "Nenhum Score calculado para esta plataforma ainda.",
      detail: null,
    };
  }

  const measured = score.measuredPillars;
  const total = score.totalPillars;
  const detail =
    measured != null && total != null
      ? `${measured} de ${total} pilares com dados${score.coverage != null ? ` · cobertura ${score.coverage}%` : ""}`
      : score.coverage != null
        ? `cobertura ${score.coverage}%`
        : null;

  // `scoreAvailable` explícito manda; o fallback cobre payloads antigos (sem o
  // campo) para não esconder um Score que já era válido.
  const available = score.scoreAvailable ?? score.overall != null;

  if (!available || score.overall == null) {
    return {
      canPersist: false,
      reason: "sem-evidencia",
      message: score.reason ?? SCORE_NOT_AVAILABLE_FALLBACK,
      detail,
    };
  }

  if (isDuplicateOfLatest(score, history)) {
    return {
      canPersist: false,
      reason: "ja-registrado",
      message: `O último registro desta plataforma já é ${score.overall}. Sincronize novas métricas para registrar uma mudança.`,
      detail,
    };
  }

  return { canPersist: true, reason: "apto", message: null, detail };
}
