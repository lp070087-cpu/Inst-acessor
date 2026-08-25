import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Criptografia de credenciais (tokens da Meta/Instagram).
 *
 * Algoritmo: AES-256-GCM (autenticado).
 * - Chave: derivada de TOKEN_ENCRYPTION_KEY (hex) via SHA-256 → 32 bytes.
 * - IV: 12 bytes aleatórios por operação.
 * - Tag de autenticação: 16 bytes — detecta qualquer adulteração.
 *
 * Formato persistido (hex, com separador "."):
 *   <iv_hex>.<tag_hex>.<ciphertext_hex>
 *
 * USO APENAS NO SERVIDOR. Nunca importe este módulo no cliente.
 * Nunca logue tokens ou chaves.
 */

function getKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY não configurada (mín. 32 caracteres). Gere com: openssl rand -hex 32"
    );
  }
  // Deriva uma chave de 32 bytes estável a partir do segredo.
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted.toString("hex")}`;
}

export function decryptToken(payload: string): string {
  const key = getKey();
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Credencial armazenada em formato inválido");
  }
  const [ivHex, tagHex, dataHex] = parts as [string, string, string];
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/** Gera um state criptograficamente seguro (CSRF) para OAuth. */
export function randomState(): string {
  return randomBytes(24).toString("hex");
}
