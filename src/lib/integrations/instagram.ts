/**
 * Compat layer — re-exporta a camada de serviço isolada.
 *
 * IMPORTANTE: este arquivo importa EXPLICITAMENTE de "./instagram/index"
 * (e não de "./instagram") para evitar o shadowing file-sobre-diretório:
 * quando existe `instagram.ts` E `instagram/`, a resolução de "./instagram"
 * aponta para ESTE arquivo, criando um self-import que esvazia os exports.
 *
 * Novo código deve importar de "@/lib/integrations/instagram" (o diretório).
 */
export * from "./instagram/index";
