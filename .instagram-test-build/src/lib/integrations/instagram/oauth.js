"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSTAGRAM_DEFAULT_SCOPES_STRING = exports.INSTAGRAM_DEFAULT_SCOPES = void 0;
exports.getInstagramScopes = getInstagramScopes;
exports.buildAuthUrl = buildAuthUrl;
exports.exchangeCodeForToken = exchangeCodeForToken;
exports.exchangeForLongLivedToken = exchangeForLongLivedToken;
exports.refreshLongLivedToken = refreshLongLivedToken;
exports.encryptAccessToken = encryptAccessToken;
const crypto_1 = require("@/lib/crypto");
const client_1 = require("./client");
const errors_1 = require("./errors");
/**
 * FLUXO OAUTH OFICIAL — INSTAGRAM BUSINESS LOGIN
 * ==============================================
 * O app Meta "Inst Acessor" usa o caso de uso "Gerenciar mensagens e conteúdo
 * no Instagram", cujo fluxo é o Instagram Business Login. Este arquivo NÃO usa
 * o dialog do Facebook nem `graph.facebook.com`.
 *
 * Etapas oficiais:
 *
 *   1) AUTORIZAÇÃO (navegador)
 *      GET https://www.instagram.com/oauth/authorize
 *          ?client_id=<INSTAGRAM_APP_ID>
 *          &redirect_uri=<INSTAGRAM_REDIRECT_URI>
 *          &response_type=code
 *          &scope=<scopes>
 *          &state=<state CSRF>
 *
 *   2) TROCA DO `code` (servidor) → token de CURTA duração (~1 hora)
 *      POST https://api.instagram.com/oauth/access_token
 *           (application/x-www-form-urlencoded)
 *           client_id, client_secret, grant_type=authorization_code,
 *           redirect_uri, code
 *
 *   3) TOKEN DE LONGA DURAÇÃO (~60 dias) — passo OBRIGATÓRIO: o token da
 *      etapa 2 expira em ~1 hora e não serve para operar o app.
 *      GET https://graph.instagram.com/access_token
 *          ?grant_type=ig_exchange_token
 *          &client_secret=<app secret>
 *          &access_token=<token curto>
 *
 *   4) RENOVAÇÃO (ver `refreshLongLivedToken`) — o token longo pode ser
 *      renovado por mais ~60 dias, desde que tenha ao menos 24 horas de vida
 *      e ainda não tenha expirado.
 *      GET https://graph.instagram.com/refresh_access_token
 *          ?grant_type=ig_refresh_token
 *          &access_token=<token longo>
 *
 * Segurança:
 *   - state/CSRF preservado no passo 1 (validado no callback).
 *   - client_secret vai no BODY (nunca na query/URL).
 *   - Fail-closed: sem configuração, lança `IntegrationConfigError`.
 */
/** Scopes oficiais do Instagram Business Login usados pelo Inst Acessor. */
exports.INSTAGRAM_DEFAULT_SCOPES = [
    "instagram_business_basic",
    "instagram_business_manage_comments",
    "instagram_business_manage_messages",
    "instagram_business_manage_insights",
    "instagram_business_content_publish",
];
const DEFAULT_SCOPES = exports.INSTAGRAM_DEFAULT_SCOPES.join(",");
exports.INSTAGRAM_DEFAULT_SCOPES_STRING = DEFAULT_SCOPES;
/**
 * Scopes efetivos.
 * `INSTAGRAM_SCOPES` continua sendo o OVERRIDE por variável de ambiente
 * (lista separada por vírgula). Quando ausente, usa os 5 scopes oficiais.
 */
function getInstagramScopes() {
    const override = process.env.INSTAGRAM_SCOPES?.trim();
    return override && override.length > 0 ? override : DEFAULT_SCOPES;
}
/** URL oficial de autorização do Instagram Business Login. */
function buildAuthUrl(state) {
    const { appId } = (0, client_1.getMetaCredentials)();
    const redirectUri = (0, client_1.getRedirectUri)();
    const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: getInstagramScopes(),
        state,
    });
    return `${client_1.INSTAGRAM_AUTHORIZE_BASE}/oauth/authorize?${params.toString()}`;
}
/**
 * Passo 2+3: troca o `code` por um token de LONGA duração.
 *
 * Faz a troca do code (`api.instagram.com`) e, em seguida, o exchange
 * obrigatório para long-lived (`graph.instagram.com`). O token devolvido é o
 * de ~60 dias — é ele que é persistido criptografado.
 *
 * Se o exchange falhar, o token curto NÃO é devolvido: um token de 1 hora
 * gravado no banco produziria uma conexão que "conecta" e quebra minutos
 * depois. Fail-closed.
 */
async function exchangeCodeForToken(code) {
    const { appId, appSecret } = (0, client_1.getMetaCredentials)();
    const redirectUri = (0, client_1.getRedirectUri)();
    // ---- Passo 2: code → token curto ----
    let short;
    try {
        short = await (0, client_1.postFormNoRetry)(`${client_1.INSTAGRAM_OAUTH_BASE}/oauth/access_token`, {
            client_id: appId,
            client_secret: appSecret,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            code,
        });
    }
    catch (error) {
        if (error instanceof errors_1.IntegrationConfigError)
            throw error;
        throw new errors_1.InstagramApiError("Erro de rede ao trocar o código pelo token do Instagram.", "NETWORK");
    }
    const shortToken = typeof short.access_token === "string" ? short.access_token : "";
    if (!shortToken) {
        const detail = typeof short.error_message === "string" && short.error_message.length < 200
            ? short.error_message
            : "Erro ao obter token de acesso do Instagram.";
        throw new errors_1.InstagramApiError(detail, "TOKEN_EXCHANGE");
    }
    // Scopes efetivamente concedidos (permissions é o nome atual).
    const granted = (typeof short.permissions === "string" && short.permissions) ||
        (typeof short.scope === "string" && short.scope) ||
        getInstagramScopes();
    // ---- Passo 3: token curto → token longo (~60 dias) ----
    const long = await exchangeForLongLivedToken(shortToken, appSecret);
    return {
        accessToken: long.accessToken,
        expiresAt: long.expiresAt,
        scopes: granted,
    };
}
/**
 * Passo 3: troca um token curto por um de longa duração (~60 dias).
 * @throws Error quando a API recusa ou não devolve token.
 */
async function exchangeForLongLivedToken(shortLivedToken, appSecret) {
    const secret = appSecret ?? (0, client_1.getMetaCredentials)().appSecret;
    const params = new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: secret,
        access_token: shortLivedToken,
    });
    const data = await (0, client_1.graphGetNoRetry)(`${client_1.INSTAGRAM_GRAPH_BASE}/access_token?${params.toString()}`);
    const token = typeof data.access_token === "string" ? data.access_token : "";
    if (!token) {
        throw new errors_1.InstagramApiError("O Instagram não devolveu o token de longa duração.", "LONG_LIVED_EXCHANGE");
    }
    return {
        accessToken: token,
        expiresAt: computeExpiry(data.expires_in),
    };
}
/**
 * Passo 4: renova um token de longa duração por mais ~60 dias.
 *
 * Regras oficiais desta chamada:
 *   - só funciona para token com MAIS DE 24 HORAS de vida;
 *   - não funciona para token já expirado;
 *   - devolve um token NOVO (não estende o prazo do mesmo token).
 *
 * @throws Error quando a API recusa (ex.: token recém-emitido ou expirado).
 */
async function refreshLongLivedToken(longLivedToken) {
    const params = new URLSearchParams({
        grant_type: "ig_refresh_token",
        access_token: longLivedToken,
    });
    const data = await (0, client_1.graphGetNoRetry)(`${client_1.INSTAGRAM_GRAPH_BASE}/refresh_access_token?${params.toString()}`);
    const token = typeof data.access_token === "string" ? data.access_token : "";
    if (!token) {
        throw new errors_1.InstagramApiError("O Instagram não renovou o token de acesso.", "REFRESH_FAILED");
    }
    return {
        accessToken: token,
        expiresAt: computeExpiry(data.expires_in),
    };
}
/** Converte `expires_in` (segundos) em data absoluta. */
function computeExpiry(expiresIn) {
    const seconds = typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : 60 * 24 * 60 * 60;
    return new Date(Date.now() + seconds * 1000);
}
/** Envolve um token em uma credencial encriptada (para persistir). */
function encryptAccessToken(token) {
    return (0, crypto_1.encryptToken)(token);
}
