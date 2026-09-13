"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptToken = encryptToken;
exports.decryptToken = decryptToken;
exports.randomState = randomState;
const crypto_1 = require("crypto");
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
function getKey() {
    const secret = process.env.TOKEN_ENCRYPTION_KEY;
    if (!secret || secret.length < 32) {
        throw new Error("TOKEN_ENCRYPTION_KEY não configurada (mín. 32 caracteres). Gere com: openssl rand -hex 32");
    }
    // Deriva uma chave de 32 bytes estável a partir do segredo.
    return (0, crypto_1.createHash)("sha256").update(secret).digest();
}
function encryptToken(plaintext) {
    const key = getKey();
    const iv = (0, crypto_1.randomBytes)(12);
    const cipher = (0, crypto_1.createCipheriv)("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted.toString("hex")}`;
}
function decryptToken(payload) {
    const key = getKey();
    const parts = payload.split(".");
    if (parts.length !== 3) {
        throw new Error("Credencial armazenada em formato inválido");
    }
    const [ivHex, tagHex, dataHex] = parts;
    const decipher = (0, crypto_1.createDecipheriv)("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataHex, "hex")),
        decipher.final(),
    ]);
    return decrypted.toString("utf8");
}
/** Gera um state criptograficamente seguro (CSRF) para OAuth. */
function randomState() {
    return (0, crypto_1.randomBytes)(24).toString("hex");
}
