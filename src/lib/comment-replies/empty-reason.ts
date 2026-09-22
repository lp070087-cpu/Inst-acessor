/**
 * POR QUE A ANÁLISE NÃO DEVOLVEU NADA — núcleo puro
 * ==================================================
 * Este arquivo existe por causa de UM defeito, e a história dele explica cada
 * linha: o card da publicação mostrava "5 comentários" (o `comments_count`
 * declarado pela Meta) e, ao clicar em "Analisar comentários", a tela dizia
 * **"Nenhum comentário novo nesta publicação."** — a MESMA frase para situações
 * que exigem ações opostas do usuário:
 *
 *   • realmente não existem comentários na publicação;
 *   • todos os comentários já foram analisados antes (nada a fazer);
 *   • a Meta FALHOU ao responder (tentar de novo);
 *   • o app não tem permissão de ler comentários (esperar o Meta liberar);
 *   • a publicação não é reconhecida pela Meta (sincronizar/reconectar);
 *   • o token expirou (reconectar);
 *   • a publicação não está no banco do Inst Acessor (sincronizar);
 *   • TODOS os comentários foram lidos mas nenhum conseguiu ser registrado
 *     (este era o pior: caía em "todos já analisados", ou seja, a tela AFIRMAVA
 *     que nada havia a fazer logo quando nada havia sido feito).
 *
 * A regra é pura de propósito: ela é a interface com o usuário, e regra de
 * interface precisa poder ser provada por execução (ver `outputs/bench-empty.mjs`).
 * O motor (`engine.ts`) só COLETA os números; a decisão mora aqui, uma vez.
 *
 * REGRA PERMANENTE: um vazio NUNCA é classificado como "nada a fazer" sem que
 * exista prova de que tudo já foi analisado (`dedupedCount > 0`).
 */

/**
 * Motivos possíveis para a lista de itens ter vindo vazia.
 *
 * `no_media` e `media_unsynced` são o MESMO caso (a publicação não está no
 * banco do Inst Acessor). Os dois nomes existem porque rotas antigas já
 * devolviam `no_media`; a frase e a ação são idênticas de propósito — não faria
 * sentido o usuário ver dois textos diferentes para o mesmo problema.
 */
export type AnalyzeEmptyReason =
  | "has_items"
  | "api_empty"
  | "all_deduped"
  | "db_error"
  | "no_media"
  | "media_unsynced";

/** O que o motor mediu — os fatos, sem opinião. */
export interface EmptySignals {
  /** Quantos itens analisados de fato saíram da leva. */
  itemsCount: number;
  /** Quantos comentários a Meta (ou o banco, no fallback) devolveu. */
  fetchedCount: number;
  /** Quantos foram pulados por já existir registro de análise. */
  dedupedCount: number;
  /** Quantos comentários falharam ao ser processados/gravados. */
  readErrorCount: number;
  /**
   * Houve erro de LEITURA ou de processamento. Atenção: falha ao PERSISTIR os
   * comentários NÃO entra aqui — ela não impede a análise e tem campo próprio,
   * porque marcá-la aqui transformava "guardei mal" em "não havia nada".
   */
  hasDbError: boolean;
  /** A publicação existe no banco do Inst Acessor? */
  mediaKnown: boolean;
}

/**
 * Decide o motivo do vazio. A ORDEM das perguntas é a regra — cada condição só
 * é avaliada quando as anteriores não se aplicam.
 */
export function analyzeEmptyReason(s: EmptySignals): AnalyzeEmptyReason {
  // 1. Saíram itens: a leva produziu resultado. Nada a explicar.
  if (s.itemsCount > 0) return "has_items";

  // 2. A fonte não devolveu NADA. Este é o único vazio que significa
  //    literalmente "não existem comentários" — e por isso ele vem antes de
  //    qualquer hipótese de falha: não há o que falhar em zero comentário.
  if (s.fetchedCount === 0) {
    return s.mediaKnown ? "api_empty" : "media_unsynced";
  }

  // 3. Havia comentários e TODOS falharam. Antes isto caía em "all_deduped".
  if (s.readErrorCount > 0 && s.readErrorCount >= s.fetchedCount) return "db_error";

  // 4. Havia comentários e houve erro declarado de leitura/gravação.
  if (s.hasDbError) return "db_error";

  // 5. INVARIANTE DE CONTABILIDADE. Todo comentário lido tem exatamente um
  //    destino: virou item, foi deduplicado ou falhou. Se a soma não fecha com
  //    o que foi lido, a leva perdeu comentários no caminho — e isso é uma
  //    falha, não um "nada a fazer". Este é o caso que faltava: 5 lidos, 3
  //    deduplicados, 2 simplesmente sumiram sem erro. Sem esta checagem a tela
  //    diria "todos já foram analisados" com 2 comentários não analisados.
  const contabilizados = s.itemsCount + s.dedupedCount + s.readErrorCount;
  if (contabilizados !== s.fetchedCount) return "db_error";
  if (s.dedupedCount === 0) return "db_error";

  // 6. Só agora o caso legítimo: existiam comentários e todos já tinham
  //    registro de análise — a contabilidade acima prova que não sobrou nenhum.
  return "all_deduped";
}

/**
 * O vazio merece uma AÇÃO do usuário? Usado pela UI para escolher entre um
 * toast informativo e um aviso com botão (sincronizar / reconectar).
 */
export function emptyReasonNeedsAction(reason: AnalyzeEmptyReason): boolean {
  return reason === "media_unsynced" || reason === "db_error" || reason === "no_media";
}

/** Frase do produto para cada motivo — a UI usa exatamente estas. */
export function emptyReasonNotice(
  reason: AnalyzeEmptyReason,
  fetchedCount: number
): { text: string; tone: "info" | "warning" | "error" } {
  switch (reason) {
    case "all_deduped":
      return {
        text: `${fetchedCount} comentário(s) nesta publicação já foram analisados. Veja em Aprovações.`,
        tone: "info",
      };
    case "media_unsynced":
    case "no_media":
      return {
        text: "Esta publicação ainda não está sincronizada no Inst Acessor. Sincronize a conta e tente novamente.",
        tone: "warning",
      };
    case "db_error":
      return {
        text:
          fetchedCount > 0
            ? `Encontramos ${fetchedCount} comentário(s), mas nenhum pôde ser registrado agora. Tente novamente em instantes.`
            : "Não foi possível registrar a análise agora. Tente novamente em instantes.",
        tone: "error",
      };
    case "api_empty":
      return {
        text: "O Instagram respondeu e não devolveu comentários para esta publicação.",
        tone: "info",
      };
    default:
      return { text: "", tone: "info" };
  }
}
