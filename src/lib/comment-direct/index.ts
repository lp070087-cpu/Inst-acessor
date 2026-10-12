/**
 * COMENTÁRIO → DIRECT — CAMADA
 * ============================
 * Automação DIFERENTE das Respostas Inteligentes:
 *   - Respostas Inteligentes: comentário → resposta PÚBLICA no comentário.
 *   - Comentário → Direct:    comentário → mensagem PRIVADA no Direct.
 *
 * Reutiliza a MESMA conexão (`SocialConnection`) e o MESMO token criptografado
 * do Instagram Business Login. NÃO existe segundo OAuth neste módulo.
 *
 * Módulos:
 *   - `triggers`          → núcleo PURO de decisão (sem I/O).
 *   - `permissions`       → auditoria de escopo (núcleo puro).
 *   - `instagram-direct`  → provedor real (envio + leitura) da Graph API.
 *   - `db`                → repositório dos models de Direct.
 *   - `engine`            → orquestra gatilho → travas → envio.
 *
 * Reexporta SÓ o que é de núcleo puro por padrão — quem precisa do motor importa
 * de `./engine` diretamente, para que um import de UI não arraste Prisma junto.
 */

export * from "./triggers";
export * from "./permissions";
