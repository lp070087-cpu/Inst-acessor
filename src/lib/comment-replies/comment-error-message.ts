/**
 * CÓDIGO DE ERRO DA META → FRASE PARA O USUÁRIO — núcleo puro
 * ===========================================================
 * O padrão `export function __nome` é o mesmo de `promo-countdown.tsx`: a regra
 * é pura de propósito, para poder ser provada por execução sem subir app,
 * banco nem rede (ver `outputs/bench-comment-errors.mjs`).
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * ---------------------------
 * O sync já gravava `SocialConnection.commentsErrorCode` — o código REAL
 * devolvido pela Meta quando a leitura de comentários falhava. Ninguém lia esse
 * campo. O resultado é que a tela tinha UM aviso para todas as causas: o usuário
 * via a mesma frase quando o token tinha expirado (ação: reconectar), quando o
 * app não tinha a permissão (ação: esperar a Meta liberar) e quando a Meta
 * apenas limitou as requisições (ação: tentar de novo em alguns minutos).
 *
 * Três causas, três ações, uma frase só = o usuário tenta a ação errada.
 *
 * REGRA (item 13 do escopo): a frase NUNCA mostra o código, o nome do escopo,
 * o endpoint ou qualquer termo técnico. Ela diz o que aconteceu e o que fazer.
 *
 * Códigos, conforme a tabela oficial da Meta usada em
 * `lib/comment-replies/instagram-comments.ts` (`capabilityFromMeta`):
 *   190        → token inválido/expirado
 *   10/200/3   → permissão ausente
 *   4/17/613   → limite de requisições
 *   100/33/24/803, 400, 404 → objeto inexistente ou sem acesso
 */

/** Categoria de ação. A tela usa isto para decidir se mostra botão. */
export type CommentErrorAction =
  /** Reconectar a conta em Redes Sociais. */
  | "reconnect"
  /** Apenas esperar: o limite de requisições passa sozinho. */
  | "wait"
  /** Sincronizar a conta: o problema é o espelho local da publicação. */
  | "sync"
  /** Não há ação útil — falha passageira do lado da Meta. */
  | "none";

export interface CommentErrorInfo {
  /** Frase pronta para a tela. Nunca contém termo técnico. */
  message: string;
  action: CommentErrorAction;
}

/**
 * Normaliza o código que veio do banco.
 *
 * O campo pode conter MAIS DE UM código: quando a leitura falha em publicações
 * diferentes com causas diferentes, o sync junta tudo em `"190,4"`. A frase é
 * decidida pelo código de MAIOR precedência, porque é o que exige a ação mais
 * urgente — mandar reconectar resolve também o caso de limite de requisições,
 * enquanto o contrário não é verdade.
 */
function parseCodes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Precedência das famílias de código: menor índice = mais urgente. */
function family(code: string): number {
  if (code === "190") return 0; // token: reconectar resolve tudo
  if (code === "10" || code === "200" || code === "3") return 1; // permissão
  if (code === "4" || code === "17" || code === "613") return 2; // limite
  if (
    code === "100" ||
    code === "33" ||
    code === "24" ||
    code === "803" ||
    code === "400" ||
    code === "404"
  ) {
    return 3; // publicação
  }
  return 4; // desconhecido
}

/**
 * Traduz o código (ou a lista de códigos) persistido pelo sync na frase que o
 * usuário lê, junto da ação correspondente.
 *
 * `null`/vazio devolve a frase genérica de falha de comentários — que é
 * exatamente o caso "não sabemos o motivo, mas não foi a publicação": a
 * listagem continua visível e só os comentários falharam.
 */
export function commentErrorInfo(
  raw: string | null | undefined
): CommentErrorInfo {
  const codes = parseCodes(raw);

  if (codes.length === 0) {
    return {
      message: "Não foi possível atualizar os comentários desta publicação.",
      action: "none",
    };
  }

  const chosen = codes.slice().sort((a, b) => family(a) - family(b))[0];

  switch (family(chosen)) {
    case 0:
      return {
        message:
          "Precisamos renovar a autorização do Instagram para atualizar os comentários.",
        action: "reconnect",
      };
    case 1:
      return {
        message:
          "O Instagram ainda não liberou o acesso aos comentários desta conta. Reconecte para tentar novamente; se o aviso continuar, o acesso está em análise pela Meta.",
        action: "reconnect",
      };
    case 2:
      return {
        message:
          "O Instagram limitou temporariamente as requisições. Os comentários voltam a atualizar em alguns minutos.",
        action: "wait",
      };
    case 3:
      return {
        message:
          "Algumas publicações não puderam ser lidas no Instagram. Sincronize a conta para atualizar a lista.",
        action: "sync",
      };
    default:
      return {
        message: "Não foi possível atualizar os comentários desta publicação.",
        action: "none",
      };
  }
}

/**
 * A publicação tem comentários que não conseguimos ler?
 *
 * Existe separado da frase porque a regra é outra e mais importante: uma falha
 * de comentários JAMAIS pode esconder a publicação. O sync grava `null` em
 * `InstagramComment` quando a leitura falha (não apaga o que existe) e `false`
 * em `commentsAvailable` — e é essa combinação que a UI usa para dizer
 * "não conseguimos atualizar" sem dizer "não tem comentário".
 */
export function commentsReadFailed(
  commentsAvailable: boolean | null | undefined
): boolean {
  return commentsAvailable === false;
}
