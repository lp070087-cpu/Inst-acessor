"use strict";
/**
 * ASAAS — TIPOS OFICIAIS (espelho mínimo da API v3)
 * ===================================================
 * Apenas os campos que o Inst Acessor realmente usa. Nada além disso é
 * inventado — campos não mapeados são ignorados.
 *
 * Fontes: API Asaas v3 (documentação oficial). Nomes de eventos abaixo
 * usam APENAS nomes confirmados.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASAAS_KNOWN_EVENTS = exports.ASAAS_SUBSCRIPTION_EVENTS = void 0;
// ------------------------------------------------------------
// Webhook — eventos CONFIRMADOS (não inventar nomes)
// ------------------------------------------------------------
// Eventos de assinatura confirmados no escopo oficial:
exports.ASAAS_SUBSCRIPTION_EVENTS = [
    "SUBSCRIPTION_CREATED",
    "SUBSCRIPTION_UPDATED",
    "SUBSCRIPTION_INACTIVATED",
    "SUBSCRIPTION_DELETED",
];
// Eventos de pagamento (documentados como "os mesmos de Payment" na doc do
// Asaas — mas a instrução do projeto manda NÃO extrapolar sem confirmação).
// Aqui definimos apenas os que usamos de forma conservadora e registramos
// no relatório que os nomes EXATOS devem ser conferidos na doc oficial antes
// de habilitar. O webhook aceita eventos por lista explícita, não por regex.
exports.ASAAS_KNOWN_EVENTS = [
    ...exports.ASAAS_SUBSCRIPTION_EVENTS,
    "PAYMENT_CREATED",
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED",
    "PAYMENT_OVERDUE",
    "PAYMENT_CANCELED",
    "PAYMENT_REFUNDED",
];
