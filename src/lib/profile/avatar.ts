/**
 * AVATAR DA CONTA — validação server-side
 * ========================================
 * POR QUE ESTE ARQUIVO EXISTE
 * ---------------------------
 * O projeto NÃO possui storage de arquivos (nem Vercel Blob, nem S3, nem
 * Supabase): nenhuma dependência de upload no package.json e nenhuma rota de
 * upload em `src/app/api`. As imagens que o app já exibe são URLs REMOTAS
 * fornecidas pelas próprias plataformas (Instagram/TikTok).
 *
 * Como não existe infraestrutura de storage para reutilizar, e como a regra do
 * projeto é NÃO inventar infraestrutura nova, o avatar é guardado no campo que
 * JÁ EXISTE no schema (`UserProfile.avatar`, varchar) como **data URL**.
 *
 * Isso é seguro porque o arquivo é reduzido no navegador (256px, JPEG) antes de
 * subir e o servidor impõe um teto pequeno. Não é o lugar de uma foto original.
 * Quando houver storage real, SÓ O VALOR gravado muda (URL em vez de data URL) —
 * o campo, a rota e a UI continuam os mesmos.
 *
 * O QUE O SERVIDOR VALIDA (o `accept` do <input> é só conveniência de UI)
 * ---------------------------------------------------------------------
 *   1. o arquivo não está vazio;
 *   2. o tamanho está dentro do teto — checado ANTES de ler o conteúdo;
 *   3. o conteúdo é realmente uma imagem, pelos MAGIC BYTES (não pelo
 *      Content-Type nem pela extensão, que o cliente controla);
 *   4. o tamanho decodificado também está dentro do teto.
 *
 * Português/UTF-8: nenhuma mensagem de erro é montada a partir de texto vindo
 * do cliente — as strings são literais deste arquivo.
 */

/** Teto do arquivo ORIGINAL escolhido pelo usuário (antes da redução no browser). */
export const MAX_AVATAR_BYTES = 256 * 1024; // 256 KB

/** Tipos aceitos. WEBP fica de fora: a redução no canvas depende do suporte do
 *  navegador, e o formato teria de sobreviver ao reencode em todo caminho. */
export const ALLOWED_AVATAR_MIME = ["image/jpeg", "image/png"] as const;
export type AllowedAvatarMime = (typeof ALLOWED_AVATAR_MIME)[number];

export type AvatarValidation =
  | { ok: true; dataUrl: string; mime: AllowedAvatarMime; bytes: number }
  | { ok: false; error: string };

/** Lê os primeiros bytes e decide o formato REAL da imagem. */
function sniffMime(buf: Buffer): AllowedAvatarMime | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

/**
 * Valida um avatar enviado como data URL.
 *
 * Devolve sempre uma mensagem pronta para exibição — nunca lança, nunca
 * devolve o conteúdo recebido de volta.
 */
export function validateAvatarDataUrl(input: unknown): AvatarValidation {
  if (typeof input !== "string" || input.trim().length === 0) {
    return { ok: false, error: "Selecione uma imagem para usar como foto." };
  }

  const raw = input.trim();

  const match = /^data:([a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+);base64,(.+)$/i.exec(raw);
  if (!match) {
    return {
      ok: false,
      error: "Formato de imagem não reconhecido. Envie um arquivo PNG ou JPG.",
    };
  }

  const declaredMime = match[1].toLowerCase();
  const base64 = match[2];

  if (declaredMime === "image/webp") {
    return {
      ok: false,
      error: "Imagens WEBP ainda não são aceitas. Envie um arquivo PNG ou JPG.",
    };
  }
  if (!(ALLOWED_AVATAR_MIME as readonly string[]).includes(declaredMime)) {
    return {
      ok: false,
      error: "Formato não aceito. Envie um arquivo PNG ou JPG.",
    };
  }

  // O tamanho em base64 é ~4/3 do binário. Checagem barata ANTES de decodificar:
  // um data URL gigante nunca chega a virar Buffer.
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      error: `A imagem é muito grande. O limite é ${Math.round(
        MAX_AVATAR_BYTES / 1024
      )} KB — escolha um arquivo menor.`,
    };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, error: "Não foi possível ler a imagem. Tente novamente." };
  }

  if (buf.length === 0) {
    return { ok: false, error: "O arquivo enviado está vazio." };
  }

  if (buf.length > MAX_AVATAR_BYTES) {
    return {
      ok: false,
      error: `A imagem é muito grande. O limite é ${Math.round(
        MAX_AVATAR_BYTES / 1024
      )} KB — escolha um arquivo menor.`,
    };
  }

  // A verdade está nos bytes, não no que o navegador declarou.
  const realMime = sniffMime(buf);
  if (!realMime) {
    return {
      ok: false,
      error: "O arquivo enviado não é uma imagem válida (PNG ou JPG).",
    };
  }

  return {
    ok: true,
    dataUrl: `data:${realMime};base64,${buf.toString("base64")}`,
    mime: realMime,
    bytes: buf.length,
  };
}
