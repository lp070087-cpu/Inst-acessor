import { z } from "zod";

/**
 * Validações centrais das preferências da conta (Fase 10).
 * Usado pela página /configuracoes.
 */

const LOCALES = ["pt-BR", "en-US", "es-ES"] as const;
const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Belem",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
  "America/Noronha",
  "UTC",
] as const;

export const updatePreferencesSchema = z.object({
  locale: z.enum(LOCALES, { message: "Idioma inválido" }),
  timezone: z.enum(TIMEZONES, { message: "Fuso horário inválido" }),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
