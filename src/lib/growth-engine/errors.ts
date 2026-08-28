import { GrowthEngineError } from "./types";

/**
 * ERROS DO GROWTH ENGINE — Fase 8
 * =================================
 * Erros controlados, sem vazar detalhes internos. Todas as rotas da Fase 8
 * devem mapear erros para respostas HTTP seguras (sem stack/detalhe interno).
 */

/** Erro padrão de contexto insuficiente (dado ausente/inválido). */
export function insufficientDataError(detail: string): GrowthEngineError {
  return new GrowthEngineError("DADO_INSUFICIENTE", detail);
}

/** Erro de ownership (o recurso pertence a outro usuário). */
export function notFoundError(detail = "Recurso não encontrado"): GrowthEngineError {
  return new GrowthEngineError("NAO_ENCONTRADO", detail);
}

/** Erro de validação de entrada. */
export function validationError(detail: string): GrowthEngineError {
  return new GrowthEngineError("VALIDACAO", detail);
}

/** Mapeia um erro desconhecido para resposta HTTP segura (status code). */
export function toGrowthHttpError(err: unknown): { status: number; code: string; message: string } {
  if (err instanceof GrowthEngineError) {
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
