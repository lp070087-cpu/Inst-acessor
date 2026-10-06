"use client";

/**
 * UPLOAD EM LOTE PARA A BIBLIOTECA
 * =================================
 * Subir 50 arquivos de uma vez NÃO pode virar 50 uploads simultâneos: o
 * navegador abre 50 conexões, a rede satura, o servidor recebe 50 assinaturas
 * ao mesmo tempo e o usuário não vê progresso de nada. Aqui a fila é explícita:
 * um número fixo de uploads em voo, e o próximo só começa quando um termina.
 *
 * O binário vai DIRETO do navegador para o Blob (fluxo que o projeto já usa:
 * `/api/upload/media` só assina o token, o arquivo nunca trafega pelo nosso
 * servidor). Depois que o upload termina, a REFERÊNCIA é registrada no banco via
 * `POST /api/media-library`.
 *
 * O token do Blob nunca chega aqui: quem o usa é a lib `@vercel/blob/client`,
 * que o recebe do endpoint de assinatura já autenticado.
 */

/** Uploads simultâneos. Baixo de propósito — o gargalo é a rede do usuário. */
const CONCURRENCY = 3;

/** Tentativas por arquivo. Falha de rede é comum em 3G/4G. */
const MAX_ATTEMPTS = 2;

export interface UploadItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  /** 0–100 do arquivo atual. */
  progress: number;
  error?: string;
}

export interface UploadOutcome {
  id: string;
  ok: boolean;
  error?: string;
}

export interface UploadProgress {
  done: number;
  total: number;
  current: string | null;
}

/**
 * Envia os arquivos respeitando o limite de concorrência.
 *
 * `onItem` é chamado a cada mudança de um item (progresso, sucesso, erro) para
 * a tela atualizar sem precisar re-renderizar a lista inteira a cada byte.
 * `onProgress` dá o "Enviando 12 de 50".
 *
 * Devolve o resultado por arquivo — assim quem chamou sabe exatamente quais
 * falharam e pode oferecer "tentar novamente" só para eles.
 */
export async function uploadMediaBatch(
  files: File[],
  userId: string,
  handlers: {
    onItem: (id: string, patch: Partial<UploadItem>) => void;
    onProgress: (progress: UploadProgress) => void;
    /** true → aborta o que ainda não começou. */
    isCancelled?: () => boolean;
  }
): Promise<UploadOutcome[]> {
  // Import dinâmico: `@vercel/blob/client` só é necessário quando há upload de
  // verdade. Assim ele não entra no bundle inicial da Biblioteca.
  const { upload } = await import("@vercel/blob/client");

  const outcomes: UploadOutcome[] = [];
  let done = 0;

  /** Envia UM arquivo, com uma retentativa para falha transitória. */
  async function uploadOne(item: UploadItem): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        handlers.onItem(item.id, { status: "uploading", progress: 0, error: undefined });

        const safeName = item.file.name.replace(/[^\w.\-]+/g, "-") || "arquivo";
        const blob = await upload(`inst-acessor/${userId}/${safeName}`, item.file, {
          access: "public",
          handleUploadUrl: "/api/upload/media",
          onUploadProgress: ({ percentage }) => {
            // Arredonda: o callback dispara muitas vezes por segundo e não vale
            // re-renderizar a cada fração de 1%.
            handlers.onItem(item.id, { progress: Math.round(percentage) });
          },
        });

        // Registra a REFERÊNCIA no banco. Se isto falhar, o arquivo existe no
        // Blob mas não na biblioteca — então é erro, não sucesso silencioso.
        const res = await fetch("/api/media-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: blob.url,
            pathname: blob.pathname,
            mimeType: item.file.type || null,
            size: item.file.size,
            originalName: item.file.name,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Falha ao registrar a mídia.");
        }

        handlers.onItem(item.id, { status: "done", progress: 100 });
        outcomes.push({ id: item.id, ok: true });
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha no envio.";
        if (attempt < MAX_ATTEMPTS) continue;
        handlers.onItem(item.id, { status: "error", error: message });
        outcomes.push({ id: item.id, ok: false, error: message });
      }
    }
  }

  // ---- fila: no máximo CONCURRENCY em voo ----
  const queue: UploadItem[] = files.map((file, index) => ({
    id: `up-${Date.now()}-${index}`,
    file,
    status: "pending",
    progress: 0,
  }));

  const total = queue.length;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      if (handlers.isCancelled?.()) return;
      const item = queue[cursor++];
      const posicao = cursor;
      handlers.onProgress({ done, total, current: `Enviando ${posicao} de ${total}` });
      await uploadOne(item);
      done++;
      handlers.onProgress({ done, total, current: null });
    }
  }

  handlers.onProgress({ done: 0, total, current: `Enviando 1 de ${total}` });
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker())
  );

  // Itens que nunca começaram (cancelamento) entram como falha explícita —
  // melhor dizer "não enviado" do que sumir com o arquivo da contagem.
  for (const item of queue) {
    if (item.status === "pending") {
      handlers.onItem(item.id, { status: "error", error: "Envio interrompido." });
      outcomes.push({ id: item.id, ok: false, error: "Envio interrompido." });
    }
  }

  return outcomes;
}

export { CONCURRENCY as MEDIA_UPLOAD_CONCURRENCY };
