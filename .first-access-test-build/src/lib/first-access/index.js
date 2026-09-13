"use strict";
/**
 * PRIMEIRO ACESSO — SERVIÇO (server-only)
 * =========================================
 * Fluxo pós-pagamento/pós-liberação:
 *   1) O direito de acesso é vinculado ao E-MAIL (AccessGrant, origem
 *      ASAAS ou ADMIN_MANUAL).
 *   2) O cliente informa o e-mail → prova a posse (token de uso único) →
 *      cria a própria senha (bcrypt) → entra.
 *   3) NUNCA é criada senha automática/fixa; NUNCA se confirma que um
 *      e-mail tem acesso sem prova de posse (anti-enumeração).
 *
 * Segurança:
 *   - Tokens aleatórios com expiração, uso único, hash armazenado.
 *   - Não usa JWT eterno para ativação.
 *   - Respostas nunca incluem passwordHash/tokens/secrets.
 *   - `requestFirstAccess` NUNCA revela se o e-mail tem acesso.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEmail = exports.isValidOrigin = exports.isStrongPassword = exports.isFirstAccessTokenUsable = exports.hashToken = exports.generateRandomToken = exports.effectiveGrantStatus = exports.FIRST_ACCESS_TOKEN_TTL_MINUTES = exports.EMAIL_NOT_ELIGIBLE_MESSAGE = exports.ACCESS_GRANT_STATUSES = void 0;
exports.findEligibleGrant = findEligibleGrant;
exports.lookupFirstAccess = lookupFirstAccess;
exports.requestFirstAccessToken = requestFirstAccessToken;
exports.verifyFirstAccessToken = verifyFirstAccessToken;
exports.createFirstAccessAccount = createFirstAccessAccount;
exports.completeFirstAccess = completeFirstAccess;
exports.completeTour = completeTour;
exports.getActiveAccessForUser = getActiveAccessForUser;
const db_1 = require("@/lib/db");
const password_1 = require("@/lib/auth/password");
const core_1 = require("./core");
var core_2 = require("./core");
Object.defineProperty(exports, "ACCESS_GRANT_STATUSES", { enumerable: true, get: function () { return core_2.ACCESS_GRANT_STATUSES; } });
Object.defineProperty(exports, "EMAIL_NOT_ELIGIBLE_MESSAGE", { enumerable: true, get: function () { return core_2.EMAIL_NOT_ELIGIBLE_MESSAGE; } });
Object.defineProperty(exports, "FIRST_ACCESS_TOKEN_TTL_MINUTES", { enumerable: true, get: function () { return core_2.FIRST_ACCESS_TOKEN_TTL_MINUTES; } });
Object.defineProperty(exports, "effectiveGrantStatus", { enumerable: true, get: function () { return core_2.effectiveGrantStatus; } });
Object.defineProperty(exports, "generateRandomToken", { enumerable: true, get: function () { return core_2.generateRandomToken; } });
Object.defineProperty(exports, "hashToken", { enumerable: true, get: function () { return core_2.hashToken; } });
Object.defineProperty(exports, "isFirstAccessTokenUsable", { enumerable: true, get: function () { return core_2.isFirstAccessTokenUsable; } });
Object.defineProperty(exports, "isStrongPassword", { enumerable: true, get: function () { return core_2.isStrongPassword; } });
Object.defineProperty(exports, "isValidOrigin", { enumerable: true, get: function () { return core_2.isValidOrigin; } });
Object.defineProperty(exports, "normalizeEmail", { enumerable: true, get: function () { return core_2.normalizeEmail; } });
const p = db_1.prisma;
const fa = {
    accessGrant: p.accessGrant,
    firstAccessToken: p.firstAccessToken,
    user: p.user,
};
/**
 * Localiza o grant válido mais recente para o e-mail (não cancelado,
 * não expirado). Retorna null se não houver acesso liberado.
 * NÃO diferencia "e-mail sem acesso" de "e-mail inválido" externamente.
 */
async function findEligibleGrant(email) {
    const normalized = (0, core_1.normalizeEmail)(email);
    if (!normalized)
        return null;
    const now = new Date();
    const grants = (await fa.accessGrant.findMany({
        where: {
            email: normalized,
            status: { in: ["PENDING_FIRST_ACCESS", "ACTIVE"] },
        },
        orderBy: { createdAt: "desc" },
    }));
    for (const grant of grants) {
        const status = (0, core_1.effectiveGrantStatus)(grant.status, grant.expiresAt, now);
        if (status === "EXPIRED" || status === "CANCELED")
            continue;
        // Se o grant já expirou mas está PENDING/ACTIVE persistido, atualiza no banco.
        if (grant.expiresAt && grant.expiresAt.getTime() <= now.getTime()) {
            try {
                await fa.accessGrant.update({
                    where: { id: grant.id },
                    data: { status: "EXPIRED" },
                });
            }
            catch {
                /* concorrência: segue com leitura */
            }
            continue;
        }
        return grant;
    }
    return null;
}
/**
 * Verifica se o e-mail tem acesso liberado (para a tela de boas-vindas,
 * já com prova de posse). Retorna dados NÃO sensíveis.
 */
async function lookupFirstAccess(email) {
    const normalized = (0, core_1.normalizeEmail)(email);
    if (!normalized) {
        return { ok: false, eligible: false, grant: null };
    }
    const grant = await findEligibleGrant(normalized);
    if (!grant) {
        return { ok: false, eligible: false, grant: null };
    }
    return {
        ok: true,
        eligible: true,
        grant: {
            email: grant.email,
            planName: grant.planName ?? null,
            origin: grant.origin,
            startAt: grant.startAt ? grant.startAt.toISOString() : null,
            expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
            status: (0, core_1.effectiveGrantStatus)(grant.status, grant.expiresAt, new Date()),
            alreadyCompleted: grant.firstAccessCompleted,
        },
    };
}
/**
 * ETAPA 1 — solicita o token de primeiro acesso para o e-mail.
 *
 * Anti-enumeração: a resposta é SEMPRE a mesma mensagem genérica,
 * quer o e-mail tenha acesso ou não. Se houver acesso, cria um token
 * de uso único. O envio REAL do e-mail é feito por um provider desacoplado
 * (ver `src/lib/email/`); sem provider configurado, o token é apenas
 * registrado (NUNCA fingimos envio).
 */
async function requestFirstAccessToken(email) {
    const normalized = (0, core_1.normalizeEmail)(email);
    if (!normalized) {
        return { ok: false, message: core_1.EMAIL_NOT_ELIGIBLE_MESSAGE, tokenCreated: false };
    }
    const grant = await findEligibleGrant(normalized);
    if (!grant) {
        return { ok: false, message: core_1.EMAIL_NOT_ELIGIBLE_MESSAGE, tokenCreated: false };
    }
    // Se o primeiro acesso já foi concluído para este e-mail, o cliente deve
    // usar o login normal. Não emitimos mais token.
    if (grant.firstAccessCompleted) {
        return { ok: false, message: core_1.EMAIL_NOT_ELIGIBLE_MESSAGE, tokenCreated: false };
    }
    const rawToken = (0, core_1.generateRandomToken)();
    const tokenHash = (0, core_1.hashToken)(rawToken);
    const expiresAt = new Date(Date.now() + core_1.FIRST_ACCESS_TOKEN_TTL_MINUTES * 60000);
    // Invalida tokens anteriores não usados (evita múltiplos ativos).
    try {
        await fa.firstAccessToken.updateMany({
            where: { email: normalized, consumed: false },
            data: { consumed: true, usedAt: new Date() },
        });
    }
    catch {
        /* segue */
    }
    try {
        await fa.firstAccessToken.create({
            data: {
                email: normalized,
                tokenHash,
                expiresAt,
                consumed: false,
                usedAt: null,
                userId: grant.userId ?? null,
            },
        });
    }
    catch {
        return { ok: false, message: core_1.EMAIL_NOT_ELIGIBLE_MESSAGE, tokenCreated: false };
    }
    // O token cru é devolvido UMA vez, no momento da criação. O banco só guarda
    // o hash. O chamador decide o que fazer (enviar por e-mail ou exibir em dev).
    return {
        ok: true,
        message: core_1.EMAIL_NOT_ELIGIBLE_MESSAGE,
        tokenCreated: true,
        tokenExpiresAt: expiresAt.toISOString(),
        rawToken,
        email: normalized,
    };
}
/**
 * ETAPA 2 — verifica o token de uso único e retorna o e-mail + grant.
 * Consome o token APENAS quando a criação de conta/senha for concluída
 * (em `createFirstAccessAccount`), para permitir retry de UI.
 * Aqui apenas valida e devolve o e-mail.
 */
async function verifyFirstAccessToken(token) {
    if (!token || token.length < 16) {
        return { ok: false, message: "Link inválido." };
    }
    const tokenHash = (0, core_1.hashToken)(token);
    const row = (await fa.firstAccessToken.findUnique({
        where: { tokenHash },
    }));
    if (!row) {
        return { ok: false, message: "Link inválido." };
    }
    const usable = (0, core_1.isFirstAccessTokenUsable)({ consumed: row.consumed, usedAt: row.usedAt, expiresAt: row.expiresAt }, new Date());
    if (!usable) {
        return { ok: false, message: "Este link expirou ou já foi usado." };
    }
    const grant = await findEligibleGrant(row.email);
    if (!grant) {
        return { ok: false, message: "Link inválido." };
    }
    const existingUser = (await fa.user.findUnique({
        where: { email: row.email },
        select: { id: true, passwordHash: true },
    }));
    return {
        ok: true,
        email: row.email,
        grant: {
            email: grant.email,
            planName: grant.planName ?? null,
            origin: grant.origin,
            startAt: grant.startAt ? grant.startAt.toISOString() : null,
            expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
            status: (0, core_1.effectiveGrantStatus)(grant.status, grant.expiresAt, new Date()),
        },
        userExists: Boolean(existingUser?.passwordHash),
    };
}
/**
 * ETAPA 3 — cria a conta e a senha (bcrypt) e marca o primeiro acesso.
 * - Se o User já existe com senha → apenas vincula o grant (não duplica).
 * - Se o User não existe → cria com a senha escolhida pelo cliente.
 * - Consome o token de uso único (replay-safe).
 */
async function createFirstAccessAccount(input) {
    if (!(0, core_1.isStrongPassword)(input.password)) {
        return { ok: false, code: "WEAK_PASSWORD", error: "A senha deve ter no mínimo 8 caracteres." };
    }
    if (input.password !== input.confirmPassword) {
        return { ok: false, code: "WEAK_PASSWORD", error: "As senhas não coincidem." };
    }
    const tokenHash = (0, core_1.hashToken)(input.token);
    const row = (await fa.firstAccessToken.findUnique({
        where: { tokenHash },
    }));
    if (!row) {
        return { ok: false, code: "INVALID_TOKEN", error: "Link inválido." };
    }
    const usable = (0, core_1.isFirstAccessTokenUsable)({ consumed: row.consumed, usedAt: row.usedAt, expiresAt: row.expiresAt }, new Date());
    if (!usable) {
        return { ok: false, code: "INVALID_TOKEN", error: "Este link expirou ou já foi usado." };
    }
    // Consome o token ANTES de prosseguir (uso único — replay falha).
    try {
        await fa.firstAccessToken.update({
            where: { id: row.id },
            data: { consumed: true, usedAt: new Date() },
        });
    }
    catch {
        return { ok: false, code: "INVALID_TOKEN", error: "Este link expirou ou já foi usado." };
    }
    const grant = await findEligibleGrant(row.email);
    if (!grant) {
        return { ok: false, code: "NOT_ELIGIBLE", error: "Este link não está mais válido." };
    }
    const email = grant.email;
    const now = new Date();
    const passwordHash = await (0, password_1.hashPassword)(input.password);
    // A) Usuário já existe? Vincula (não duplica).
    const existing = (await fa.user.findUnique({
        where: { email },
        select: { id: true, passwordHash: true },
    }));
    let userId;
    let created = false;
    if (existing) {
        userId = existing.id;
        // Se não tinha senha (conta órfã criada por webhook), define agora.
        if (!existing.passwordHash) {
            await fa.user.update({
                where: { id: userId },
                data: { passwordHash },
            });
        }
    }
    else {
        const user = (await fa.user.create({
            data: { email, passwordHash },
        }));
        userId = user.id;
        created = true;
    }
    // Vincula o grant ao usuário e marca primeiro acesso concluído.
    await fa.accessGrant.update({
        where: { id: grant.id },
        data: {
            userId,
            status: "ACTIVE",
            firstAccessCompleted: true,
            firstAccessCompletedAt: now,
        },
    });
    // Marca no User (não duplica UserProfile.onboardingCompleted).
    await fa.user.update({
        where: { id: userId },
        data: {
            firstAccessCompleted: true,
            firstAccessCompletedAt: now,
        },
    });
    return { ok: true, created, firstAccessCompleted: true };
}
/**
 * Completa o primeiro acesso de um usuário JÁ autenticado (ex.: webhook
 * marcou como liberado, mas o usuário entrou por outro caminho e precisa
 * ser marcado). Normalmente não é necessário — o fluxo principal passa por
 * `createFirstAccessAccount`.
 */
async function completeFirstAccess(userId) {
    const user = (await fa.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstAccessCompleted: true },
    }));
    if (!user) {
        return { ok: false, code: "USER_NOT_FOUND", error: "Usuário não encontrado." };
    }
    const now = new Date();
    if (!user.firstAccessCompleted) {
        await fa.user.update({
            where: { id: userId },
            data: { firstAccessCompleted: true, firstAccessCompletedAt: now },
        });
    }
    // Também marca grants pendentes do e-mail.
    try {
        const grants = (await fa.accessGrant.findMany({
            where: { email: user.email, firstAccessCompleted: false },
        }));
        for (const grant of grants) {
            await fa.accessGrant.update({
                where: { id: grant.id },
                data: {
                    userId,
                    status: "ACTIVE",
                    firstAccessCompleted: true,
                    firstAccessCompletedAt: now,
                },
            });
        }
    }
    catch {
        /* segue */
    }
    return { ok: true };
}
/**
 * Registra a conclusão/pulo do tour guiado.
 */
async function completeTour(userId) {
    try {
        await fa.user.update({
            where: { id: userId },
            data: { tourCompleted: true, tourCompletedAt: new Date() },
        });
        return { ok: true };
    }
    catch {
        return { ok: false, error: "Não foi possível registrar o tour." };
    }
}
/**
 * Consulta o acesso ATIVO mais recente do usuário (owner-check).
 * Usado pelo layout do app para bloquear recursos quando o acesso expirou.
 * NUNCA deleta o User — apenas informa a expiração.
 */
async function getActiveAccessForUser(userId) {
    const grants = (await fa.accessGrant.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
    }));
    const now = new Date();
    // Garante que usuários que já concluíram o primeiro acesso tenham um grant
    // ACTIVE (para o layout não bloquear por falta de grant). Se não houver
    // nenhum grant, assume que o acesso está liberado (usuários antigos).
    if (grants.length === 0) {
        return {
            active: true,
            status: "ACTIVE",
            expiresAt: null,
            planName: null,
            needsFirstAccess: false,
        };
    }
    const activeGrant = grants.find((g) => g.userId === userId);
    const grant = activeGrant ?? grants[0];
    const status = (0, core_1.effectiveGrantStatus)(grant.status, grant.expiresAt, now);
    const needsFirstAccess = status === "PENDING_FIRST_ACCESS";
    return {
        active: status === "ACTIVE",
        status,
        expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
        planName: grant.planName ?? null,
        needsFirstAccess,
    };
}
