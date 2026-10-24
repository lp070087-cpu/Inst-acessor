import { createHash, randomBytes } from "node:crypto";
import { prisma, withDatabaseTransaction } from "@/lib/db";
import { registerSchema, loginSchema } from "@/lib/validators/auth";
import { hashPassword } from "./password";
import { dbRateLimiter } from "@/lib/publishing/rate-limit";
import { isEmailProviderConfigured, sendPasswordResetEmail } from "@/lib/email";

const PREFIX = "password-reset:";
export const PASSWORD_RESET_TTL_MS = 15 * 60_000;
export const PASSWORD_RESET_REQUEST_MESSAGE = "Se a conta puder recuperar o acesso, enviaremos as instruções.";
export const PASSWORD_RESET_INVALID_MESSAGE = "Não foi possível redefinir a senha. Solicite um novo link e tente novamente.";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const userPrefix = (userId: string) => `${PREFIX}${Buffer.from(userId).toString("base64url")}:`;

/** No host-header, production-domain or getAppBaseUrl fallback for email links. */
export function passwordResetOrigin(requestUrl: string): string | null {
  try {
    const configured = process.env.AUTH_URL?.trim();
    if (!configured) return null;
    const target = new URL(configured);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
    if (target.username || target.password || target.pathname !== "/" || target.search || target.hash) return null;
    if (local) {
      if (!["development", "test"].includes(process.env.NODE_ENV ?? "") || !["http:", "https:"].includes(target.protocol)) return null;
    } else if (target.protocol !== "https:" || target.port) return null;
    if (process.env.VERCEL_ENV !== "production" && ["unitrixapp.com.br", "www.unitrixapp.com.br", "inst-acessor.vercel.app"].includes(target.hostname)) return null;
    if (new URL(requestUrl).origin !== target.origin) return null;
    return target.origin;
  } catch { return null; }
}

/** Bound anonymous JSON before parsing; tokens and passwords are never logged. */
export async function readPasswordResetBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 8192) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return null; }
  finally { reader.releaseLock(); }
}

export async function requestPasswordReset(email: unknown, ip: string, requestUrl: string): Promise<"accepted" | "limited"> {
  // Both buckets apply before account lookup, including unknown/inactive emails.
  if (!await dbRateLimiter.check(`password-reset:request:ip:${digest(ip)}`, { max: 10, windowMs: PASSWORD_RESET_TTL_MS })) return "limited";
  if (typeof email !== "string" || email.length > 254) return "accepted";
  const normalized = email.trim().toLowerCase();
  if (!await dbRateLimiter.check(`password-reset:request:email:${digest(normalized)}`, { max: 3, windowMs: PASSWORD_RESET_TTL_MS })) return "limited";
  if (!loginSchema.shape.email.safeParse(normalized).success) return "accepted";
  const origin = passwordResetOrigin(requestUrl);
  if (!origin || !isEmailProviderConfigured() || !process.env.EMAIL_FROM?.trim()) return "accepted";
  try {
    const candidate = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } });
    if (!candidate) return "accepted";
    const raw = randomBytes(32).toString("hex"), tokenHash = digest(raw);
    const created = await withDatabaseTransaction(async () => {
      await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('inst-acessor:password-reset'), hashtext(${candidate.id}))::text`;
      const user = await prisma.user.findUnique({ where: { id: candidate.id }, select: { status: true, passwordHash: true, email: true } });
      if (!user || user.status !== "ACTIVE" || !user.passwordHash || user.email.toLowerCase() !== normalized) return false;
      await prisma.verificationToken.deleteMany({ where: { identifier: { startsWith: userPrefix(candidate.id) } } });
      await prisma.verificationToken.create({ data: { identifier: `${userPrefix(candidate.id)}${digest(user.passwordHash)}`, token: tokenHash, expires: new Date(Date.now() + PASSWORD_RESET_TTL_MS) } });
      return true;
    });
    if (!created) return "accepted";
    const link = new URL("/recuperar-senha", origin); link.hash = new URLSearchParams({ token: raw }).toString();
    try {
      const sent = await sendPasswordResetEmail({ to: normalized, resetUrl: link.href, expiresInMinutes: PASSWORD_RESET_TTL_MS / 60_000 });
      if (!sent.ok) await prisma.verificationToken.deleteMany({ where: { token: tokenHash } });
    } catch {
      await prisma.verificationToken.deleteMany({ where: { token: tokenHash } });
      console.error("[password-reset] envio não concluído");
    }
    return "accepted";
  } catch {
    console.error("[password-reset] solicitação não concluída");
    return "accepted";
  }
}

/** Token deletion, password CAS and invalidation of other reset links commit together. */
export async function completePasswordReset(token: unknown, password: unknown, ip: string): Promise<boolean> {
  if (!await dbRateLimiter.check(`password-reset:complete:ip:${digest(ip)}`, { max: 20, windowMs: PASSWORD_RESET_TTL_MS })) return false;
  const parsedPassword = registerSchema.innerType().shape.password.safeParse(password);
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token) || !parsedPassword.success) return false;
  const tokenHash = digest(token);
  if (!await dbRateLimiter.check(`password-reset:complete:token:${tokenHash}`, { max: 5, windowMs: PASSWORD_RESET_TTL_MS })) return false;
  try {
    const observed = await prisma.verificationToken.findUnique({ where: { token: tokenHash } });
    if (!observed || observed.expires <= new Date()) return false;
    const match = /^password-reset:([A-Za-z0-9_-]+):([a-f0-9]{64})$/.exec(observed.identifier);
    if (!match) return false;
    const userId = Buffer.from(match[1], "base64url").toString("utf8");
    if (!userId || Buffer.from(userId).toString("base64url") !== match[1]) return false;
    const nextHash = await hashPassword(parsedPassword.data);
    return await withDatabaseTransaction(async () => {
      await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('inst-acessor:password-reset'), hashtext(${userId}))::text`;
      const current = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, passwordHash: true } });
      if (!current || current.status !== "ACTIVE" || !current.passwordHash || digest(current.passwordHash) !== match[2]) return false;
      const consumed = await prisma.verificationToken.deleteMany({ where: { identifier: observed.identifier, token: tokenHash, expires: { gt: new Date() } } });
      if (consumed.count !== 1) return false;
      const changed = await prisma.user.updateMany({ where: { id: userId, status: "ACTIVE", passwordHash: current.passwordHash }, data: { passwordHash: nextHash } });
      if (changed.count !== 1) throw new Error("Password reset conflict");
      await prisma.verificationToken.deleteMany({ where: { identifier: { startsWith: userPrefix(userId) } } });
      return true;
    });
  } catch {
    console.error("[password-reset] redefinição não concluída");
    return false;
  }
}
