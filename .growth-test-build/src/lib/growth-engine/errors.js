"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insufficientDataError = insufficientDataError;
exports.notFoundError = notFoundError;
exports.validationError = validationError;
exports.toGrowthHttpError = toGrowthHttpError;
const types_1 = require("./types");
/**
 * ERROS DO GROWTH ENGINE — Fase 8
 * =================================
 * Erros controlados, sem vazar detalhes internos. Todas as rotas da Fase 8
 * devem mapear erros para respostas HTTP seguras (sem stack/detalhe interno).
 */
/** Erro padrão de contexto insuficiente (dado ausente/inválido). */
function insufficientDataError(detail) {
    return new types_1.GrowthEngineError("DADO_INSUFICIENTE", detail);
}
/** Erro de ownership (o recurso pertence a outro usuário). */
function notFoundError(detail = "Recurso não encontrado") {
    return new types_1.GrowthEngineError("NAO_ENCONTRADO", detail);
}
/** Erro de validação de entrada. */
function validationError(detail) {
    return new types_1.GrowthEngineError("VALIDACAO", detail);
}
/** Mapeia um erro desconhecido para resposta HTTP segura (status code). */
function toGrowthHttpError(err) {
    if (err instanceof types_1.GrowthEngineError) {
        switch (err.code) {
            case "NAO_ENCONTRADO":
                return { status: 404, code: err.code, message: err.message };
            case "VALIDACAO":
                return { status: 400, code: err.code, message: err.message };
            case "DADO_INSUFICIENTE":
                return { status: 422, code: err.code, message: err.message };
            default:
                return { status: 500, code: err.code, message: err.message };
        }
    }
    return {
        status: 500,
        code: "ERRO_INTERNO",
        message: "Não foi possível processar a solicitação.",
    };
}
