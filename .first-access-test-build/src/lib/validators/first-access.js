"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeTourSchema = exports.createFirstAccessSchema = exports.verifyFirstAccessTokenSchema = exports.requestFirstAccessSchema = void 0;
const zod_1 = require("zod");
/**
 * Validações Zod do PRIMEIRO ACESSO.
 * Regras seguras: nunca aceitam senha fraca; nunca expõem informação.
 */
/** Etapa 1 — solicitar token pelo e-mail da compra. */
exports.requestFirstAccessSchema = zod_1.z.object({
    // IMPORTANTE: trim/lowercase ANTES de validar — caso contrário um e-mail com
    // espaço (ex.: colado do checkout) seria rejeitado como "inválido" apesar de
    // ser o mesmo e-mail da compra.
    email: zod_1.z
        .string()
        .trim()
        .toLowerCase()
        .min(1, "Informe o e-mail utilizado na compra")
        .email("E-mail inválido"),
});
/** Verificar token (link de uso único). */
exports.verifyFirstAccessTokenSchema = zod_1.z.object({
    token: zod_1.z.string().min(16, "Link inválido"),
});
/** Criar conta e senha no primeiro acesso. */
exports.createFirstAccessSchema = zod_1.z
    .object({
    token: zod_1.z.string().min(16, "Link inválido"),
    password: zod_1.z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
    confirmPassword: zod_1.z.string(),
})
    .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
});
/** Concluir/pular o tour guiado. */
exports.completeTourSchema = zod_1.z.object({});
