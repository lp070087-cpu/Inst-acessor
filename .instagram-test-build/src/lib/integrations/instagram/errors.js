"use strict";
/**
 * Erros específicos da integração Instagram.
 * Reutiliza o classificador central (integrations/errors.ts) para
 * mapear erros em mensagens seguras e HTTP status controlados.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toErrorParam = exports.classifyIntegrationError = exports.IntegrationConfigError = exports.InstagramApiError = void 0;
var client_1 = require("./client");
Object.defineProperty(exports, "InstagramApiError", { enumerable: true, get: function () { return client_1.InstagramApiError; } });
class IntegrationConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = "IntegrationConfigError";
    }
}
exports.IntegrationConfigError = IntegrationConfigError;
var errors_1 = require("../errors");
Object.defineProperty(exports, "classifyIntegrationError", { enumerable: true, get: function () { return errors_1.classifyIntegrationError; } });
Object.defineProperty(exports, "toErrorParam", { enumerable: true, get: function () { return errors_1.toErrorParam; } });
