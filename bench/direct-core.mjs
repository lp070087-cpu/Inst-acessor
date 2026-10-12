import { matchesTrigger, normalizeText, validateTriggerConfig, SKIP_REASONS } from "../src/lib/comment-direct/triggers.ts";
import { canManageMessages, permissionState, SCOPE_MANAGE_MESSAGES } from "../src/lib/comment-direct/permissions.ts";

let fails = 0;
const eq = (a,b,l) => { if (JSON.stringify(a)!==JSON.stringify(b)) { console.error("FAIL:", l, "->", JSON.stringify(a), "esperado", JSON.stringify(b)); fails++; } else console.log("ok  ", l); };

eq(matchesTrigger("EXACT_WORD",["QUERO"],"quero!").matched, true, "EXACT_WORD casa QUERO! ~ quero");
eq(matchesTrigger("EXACT_WORD",["QUERO"],"eu quero").matched, false, "EXACT_WORD nao casa 'eu quero'");
eq(matchesTrigger("ANY_OF_LIST",["QUERO","LINK"],"Link").matched, true, "ANY_OF_LIST casa 'Link'");
eq(matchesTrigger("CONTAINS_TEXT",["quero saber"],"oi, quero saber mais!").matched, true, "CONTAINS casa substring");
eq(matchesTrigger("CONTAINS_TEXT",["a"],"qualquer").matched, false, "CONTAINS exige >=2 chars");
eq(matchesTrigger("ANY_COMMENT",[],"oi").matched, true, "ANY_COMMENT casa");
eq(matchesTrigger("ANY_COMMENT",[],"   ").matched, false, "ANY_COMMENT nao casa vazio");
eq(matchesTrigger("DESCONHECIDO",["x"],"x").matched, false, "tipo desconhecido fail-closed");
eq(normalizeText("  Quero. "), "quero", "normalize acento/pontuacao");
eq(validateTriggerConfig({triggerType:"EXACT_WORD",triggerTerms:["A","B"],messageText:"oi"}).length>0, true, "EXACT com 2 termos invalido");
eq(validateTriggerConfig({triggerType:"ANY_COMMENT",triggerTerms:[],messageText:"oi {{x}}"}).some(e=>e.field==="messageText"), true, "placeholder invalido");
eq(canManageMessages(null), false, "sem scopes => sem permissao");
eq(canManageMessages("instagram_business_basic"), false, "escopo diferente => sem permissao");
eq(canManageMessages("instagram_business_basic,instagram_business_manage_messages"), true, "escopo presente => permissao");
eq(permissionState("", SCOPE_MANAGE_MESSAGES), "unknown", "scopes vazio => unknown");
eq(typeof SKIP_REASONS.MISSING_PERMISSION, "string", "SKIP_REASONS.MISSING_PERMISSION existe");
console.log(fails ? `\n${fails} FALHA(S)` : "\nTUDO OK");
process.exit(fails ? 1 : 0);
