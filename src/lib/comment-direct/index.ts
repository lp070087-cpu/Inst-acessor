/**
 * COMENTÁRIO → DIRECT — CAMADA
 * ============================
 * Automação DIFERENTE das Respostas Inteligentes:
 *   - Respostas Inteligentes: comentário → resposta PÚBLICA no comentário.
 *   - Comentário → Direct:    comentário → mensagem PRIVADA no Direct.
 *
 * Estado desta rodada: **análise + arquitetura + núcleo de decisão**.
 * O envio real NÃO está ligado (ver docs/RELATORIO-COMENTARIO-DIRECT.md).
 *
 * Reutiliza a MESMA conexão (`SocialConnection`) e o MESMO token criptografado
 * do Instagram Business Login. NÃO existe segundo OAuth neste módulo.
 */

export * from "./triggers";
