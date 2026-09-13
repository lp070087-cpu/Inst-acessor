"use strict";
/**
 * WEBAUTHN (PASSKEY / BIOMETRIA) — PENDÊNCIA CONTROLADA
 * ======================================================
 *
 * A instrução do projeto exige que Passkey/Face ID sejam implementados APENAS
 * via WebAuthn correto — e que NUNCA sejam "fingidos". Esta camada documenta a
 * arquitetura e devolve respostas HONESTAS de "não implementado", sem criar
 * biometria falsa.
 *
 * POR QUE PENDENTE (controlada):
 *   - WebAuthn em produção exige domínio HTTPS com origin estável, RP ID
 *     configurado, e provedor de attestation. Isso é 100% de configuração
 *     externa + infraestrutura, não apenas código.
 *   - A implementação real exige: registrar challenge no servidor, validar
 *     attestation/assertion com uma lib (ex.: @simplewebauthn/server), e
 *     persistir `PasskeyCredential` (model já criado no schema).
 *   - Aqui deixamos: (1) o model `PasskeyCredential` no schema; (2) tipos e
 *     contrato de API prontos; (3) guard honesto que retorna "NÃO_CONFIGURADO".
 *
 * NENHUMA funcionalidade falsa é exposta ao usuário.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPasskeyStatus = getPasskeyStatus;
exports.startPasskeyRegistration = startPasskeyRegistration;
exports.verifyPasskeyAssertion = verifyPasskeyAssertion;
/**
 * Status honesto da integração. Sempre "pendente" nesta fase — nunca finge
 * que há passkey configurado.
 */
function getPasskeyStatus() {
    return {
        enabled: false,
        reason: "WebAuthn (Passkey/Face ID) é uma pendência controlada: requer domínio HTTPS com origin estável, RP ID e servidor de desafio. O model PasskeyCredential já está no schema, mas a implementação real exige configuração externa (produção).",
    };
}
/**
 * Placeholder de início de registro de passkey.
 * Retorna erro honesto — NÃO cria challenge falso nem passa para o browser.
 */
async function startPasskeyRegistration(_input) {
    return {
        ok: false,
        error: "Passkey (WebAuthn) ainda não está habilitado. A ativação por passkey é uma pendência controlada e requer configuração externa em produção.",
    };
}
/**
 * Placeholder de verificação de autenticação por passkey.
 * Nunca aceita credenciais falsas.
 */
async function verifyPasskeyAssertion(_payload) {
    return {
        ok: false,
        error: "Autenticação por passkey ainda não está habilitada. Use sua senha para entrar.",
    };
}
