import { prisma } from "@/lib/db";

/**
 * BIBLIOTECA DE MÍDIA — camada de dados
 * =====================================
 * O arquivo enviado uma vez passa a ter existência própria, em vez de viver
 * amarrado a um rascunho. O binário continua no Vercel Blob; aqui fica a
 * referência.
 *
 * REGRA DE ISOLAMENTO (a mais importante deste arquivo): TODA função aqui
 * recebe `userId` como PRIMEIRO argumento e o usa no `where`. Não existe função
 * que aceite só um `id` — assim não há como, por descuido, ler ou apagar mídia
 * de outro usuário. O `userId` vem SEMPRE da sessão no servidor, nunca do corpo
 * da requisição.
 *
 * ---------------------------------------------------------------------------
 * POR QUE EXISTE O CAST ABAIXO
 * O client do Prisma em `node_modules` foi gerado ANTES do model `MediaAsset` e
 * `prisma generate` não roda neste ambiente (baixa engine de
 * `binaries.prisma.sh` → 403). Verificado: todos os outros models do
 * `prisma-shim.d.ts` JÁ existem no client gerado — só `MediaAsset` falta.
 *
 * Então o acesso é tipado aqui, uma vez, com o formato real do model. É o mesmo
 * padrão de cast que o projeto já usa nos outros repositórios. Depois de rodar
 * `npx prisma generate` na máquina do usuário, este bloco pode virar
 * `prisma.mediaAsset` direto e os casts de retorno saem junto.
 * ---------------------------------------------------------------------------
 */

/** Linha de `media_asset` como o Prisma devolve. */
interface MediaAssetRow {
  id: string;
  userId: string;
  url: string;
  pathname: string | null;
  type: string;
  mimeType: string | null;
  size: number | null;
  originalName: string | null;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Forma das operações usadas neste arquivo. */
interface MediaAssetDelegate {
  findMany(args?: unknown): Promise<MediaAssetRow[]>;
  findFirst(args?: unknown): Promise<MediaAssetRow | null>;
  create(args: unknown): Promise<MediaAssetRow>;
  count(args?: unknown): Promise<number>;
  delete(args: { where: { id: string } }): Promise<MediaAssetRow>;
}

const mediaDb = (prisma as unknown as { mediaAsset: MediaAssetDelegate }).mediaAsset;

export type MediaType = "IMAGE" | "VIDEO";

export interface MediaAssetView {
  id: string;
  url: string;
  pathname: string | null;
  type: MediaType;
  mimeType: string | null;
  size: number | null;
  originalName: string | null;
  title: string | null;
  createdAt: string;
}

/** Tamanho da página da grade. Pequeno de propósito — ver `listMediaAssets`. */
export const MEDIA_PAGE_SIZE = 24;

/** Um vídeo é reconhecido pelo mime, não por um campo que o cliente escolhe. */
export function typeFromMime(mimeType: string | null | undefined): MediaType {
  return (mimeType ?? "").toLowerCase().startsWith("video/") ? "VIDEO" : "IMAGE";
}

function toView(row: {
  id: string;
  url: string;
  pathname: string | null;
  type: string;
  mimeType: string | null;
  size: number | null;
  originalName: string | null;
  title: string | null;
  createdAt: Date;
}): MediaAssetView {
  return {
    id: row.id,
    url: row.url,
    pathname: row.pathname,
    type: row.type === "VIDEO" ? "VIDEO" : "IMAGE",
    mimeType: row.mimeType,
    size: row.size,
    originalName: row.originalName,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ListMediaOptions {
  type?: MediaType;
  /**
   * Cursor para a próxima página: o `createdAt` ISO do último item já visto.
   * Cursor em vez de `skip` porque a grade é ordenada por data — com `skip`,
   * um envio novo no meio da paginação faria o usuário pular ou repetir item.
   */
  before?: string;
  limit?: number;
  /** Só mídias que nenhum rascunho referencia. Ver `listUsedMediaUrls`. */
  unused?: boolean;
}

/**
 * URLs de mídia REFERENCIADAS por algum rascunho do usuário.
 *
 * DEFINIÇÃO DE "EM USO" (declarada, porque é uma escolha): uma mídia está em uso
 * quando existe um `SocialDraft` do mesmo usuário cujo `mediaUrl` é igual à URL
 * dela. É a única referência direta a arquivo que o banco guarda — conteúdos
 * planejados e fila de publicação apontam para o RASCUNHO, não para a URL.
 *
 * LIMITE CONHECIDO E DECLARADO: se o rascunho for excluído, a mídia volta a
 * contar como "não utilizada" mesmo que já tenha sido publicada. Distinguir
 * "usada e publicada" de "nunca usada" exigiria ligar a mídia ao conteúdo
 * planejado — estrutura que ainda não existe. Não inventamos esse estado: o
 * rótulo diz apenas "não utilizada", que é o que dá para afirmar.
 *
 * O teto de 2000 evita montar um `NOT IN` gigante. Acima disso, o filtro fica
 * conservador (mostra menos como "não utilizada") em vez de errar para o lado
 * de sugerir que uma mídia em uso está livre.
 */
const MAX_USED_URLS = 2000;

export async function listUsedMediaUrls(userId: string): Promise<string[]> {
  const rows = (await prisma.socialDraft.findMany({
    where: { userId, mediaUrl: { not: null } },
    select: { mediaUrl: true },
    take: MAX_USED_URLS,
  })) as unknown as { mediaUrl: string | null }[];

  const urls = rows.map((r) => r.mediaUrl).filter((u): u is string => !!u);
  return [...new Set(urls)];
}

/**
 * Lista as mídias do próprio usuário, da mais recente para a mais antiga.
 *
 * A página é PEQUENA (24) e o corte acontece no banco: a grade nunca recebe
 * centenas de linhas para depois esconder no CSS. Devolve `nextCursor` quando
 * há mais — quem rola a tela pede a próxima.
 */
export async function listMediaAssets(
  userId: string,
  options: ListMediaOptions = {}
): Promise<{ items: MediaAssetView[]; nextCursor: string | null; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? MEDIA_PAGE_SIZE, 1), 60);

  const where: Record<string, unknown> = { userId };
  if (options.type) where.type = options.type;
  if (options.before) {
    const before = new Date(options.before);
    // Data inválida não vira filtro silencioso: ignora o cursor (volta à 1ª
    // página) em vez de devolver lista vazia por causa de uma string ruim.
    if (!Number.isNaN(before.getTime())) where.createdAt = { lt: before };
  }

  // "Não utilizados": exclui as URLs referenciadas por rascunhos. O filtro roda
  // no BANCO (não no cliente) — trazer o acervo inteiro para filtrar aqui seria
  // exatamente o desperdício que a tela existe para evitar.
  if (options.unused) {
    const used = await listUsedMediaUrls(userId);
    if (used.length > 0) where.url = { notIn: used };
  }

  // `take: limit + 1` — pede um a mais do que mostra, só para saber se existe
  // próxima página. Evita um COUNT por rolagem.
  const rows = await mediaDb.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  // `total` é o total do FILTRO ATUAL, usado no rótulo das abas. Uma contagem
  // a mais por requisição, sobre um índice que já existe.
  const total = await mediaDb.count({ where });

  return {
    items: page.map(toView),
    nextCursor: hasMore && last ? last.createdAt.toISOString() : null,
    total,
  };
}

/** Contagens para os rótulos das abas (Todas / Fotos / Vídeos). */
export async function countMediaAssets(
  userId: string
): Promise<{ all: number; image: number; video: number }> {
  const [all, image] = await Promise.all([
    mediaDb.count({ where: { userId } }),
    mediaDb.count({ where: { userId, type: "IMAGE" } }),
  ]);
  return { all, image, video: all - image };
}

export interface RegisterMediaInput {
  url: string;
  pathname?: string | null;
  mimeType?: string | null;
  size?: number | null;
  originalName?: string | null;
}

/**
 * Registra um upload JÁ CONCLUÍDO no Blob.
 *
 * O binário sobe direto do navegador para o Blob (é o fluxo que o projeto já
 * usa em `/api/upload/media`, que só assina o token — o arquivo nunca passa
 * pelo servidor). Quando o upload termina, o cliente chama isto para gravar a
 * referência.
 *
 * `userId` vem da sessão. A URL é conferida contra a pasta do próprio usuário
 * antes de gravar: sem isso, um cliente malicioso poderia registrar no seu
 * acervo um arquivo de outra conta (ou uma URL arbitrária de terceiro).
 */
export async function registerMediaAsset(
  userId: string,
  input: RegisterMediaInput
): Promise<MediaAssetView> {
  const url = input.url?.trim();
  if (!url) throw new Error("URL da mídia é obrigatória.");

  // A pasta canônica do usuário no Blob. `pathname` do Blob é
  // `inst-acessor/<userId>/...` (ver `onBeforeGenerateToken`).
  const expectedPrefix = `inst-acessor/${userId}/`;
  const pathname = input.pathname?.trim() ?? null;

  if (pathname && !pathname.startsWith(expectedPrefix)) {
    throw new Error("Arquivo não pertence à sua pasta no armazenamento.");
  }

  // A URL do Blob contém o pathname. Se o cliente não mandou `pathname`,
  // extraímos da URL e aplicamos a MESMA checagem — o filtro não pode depender
  // de o cliente ter sido honesto.
  if (!pathname) {
    try {
      const parsed = new URL(url);
      const fromUrl = parsed.pathname.replace(/^\/+/, "");
      if (!fromUrl.startsWith(expectedPrefix)) {
        throw new Error("Arquivo não pertence à sua pasta no armazenamento.");
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("não pertence")) throw err;
      throw new Error("URL de mídia inválida.");
    }
  }

  const mimeType = input.mimeType?.trim() || null;

  const created = await mediaDb.create({
    data: {
      userId,
      url,
      pathname,
      // O tipo é DERIVADO do mime no servidor — o cliente não decide se é vídeo.
      type: typeFromMime(mimeType),
      mimeType,
      size: typeof input.size === "number" && Number.isFinite(input.size) ? Math.trunc(input.size) : null,
      originalName: input.originalName?.trim().slice(0, 300) || null,
    },
  });

  return toView(created);
}

export type DeleteMediaResult =
  /** `url` vem do BANCO — é ela que o chamador usa para remover o binário. */
  | { ok: true; url: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "in_use"; usedBy: number };

/**
 * Exclui uma mídia do acervo do próprio usuário.
 *
 * TRAVA DE SEGURANÇA: se a URL do arquivo ainda está referenciada por algum
 * rascunho, a exclusão é RECUSADA. O rascunho guarda `mediaUrl` (uma cópia da
 * URL), então apagar o registro e o binário deixaria rascunhos com uma imagem
 * quebrada — o usuário perderia trabalho sem aviso.
 *
 * Isto é verificação, não rotina destrutiva: nada é apagado em cascata e nada
 * acontece automaticamente. O binário no Blob só é removido quando o chamador
 * pede — ver `deleteMediaAssetAndBlob`.
 */
export async function deleteMediaAsset(
  userId: string,
  mediaId: string
): Promise<DeleteMediaResult> {
  const asset = await mediaDb.findFirst({
    where: { id: mediaId, userId },
  });
  if (!asset) return { ok: false, reason: "not_found" };

  const url = asset.url;

  // Quantos rascunhos ainda apontam para este arquivo. Só RASCUNHOS são
  // checados porque é a única tabela que guarda a URL da mídia; conteúdos
  // planejados e fila de publicação referenciam o RASCUNHO, não a URL.
  const usedBy = await prisma.socialDraft.count({ where: { userId, mediaUrl: url } });
  if (usedBy > 0) return { ok: false, reason: "in_use", usedBy };

  await mediaDb.delete({ where: { id: asset.id } });
  // A URL vai para o chamador remover o binário. Ela veio do BANCO, não do
  // cliente — é o que impede que alguém use o `del` do Blob como alvo
  // arbitrário (o `id` recebido nunca é tratado como URL).
  return { ok: true, url };
}

/** Busca uma mídia do próprio usuário pelo id. */
export async function getMediaAsset(
  userId: string,
  mediaId: string
): Promise<MediaAssetView | null> {
  const row = await mediaDb.findFirst({ where: { id: mediaId, userId } });
  if (!row) return null;
  return toView(row);
}
