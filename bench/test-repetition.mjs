#!/usr/bin/env node
/**
 * TESTE — DEDUPLICAÇÃO DE RESPOSTAS REPETIDAS (núcleo puro)
 * =========================================================
 * Prova, sem banco e sem rede, que a detecção de repetição de uma leva faz o
 * que promete: `isTooSimilar` (Jaccard ≥ 0.8) e a semântica de `markRepetitions`
 * — incluindo a comparação contra as respostas JÁ USADAS (segundo argumento),
 * que era o pedaço que faltava no fluxo original.
 *
 * Não importa TypeScript do app (não há build step aqui); reimplementa as duas
 * funções puras EXATAMENTE como estão em
 * `src/lib/comment-replies/{generator,engine}.ts`. Se o comportamento do app
 * mudar, este arquivo precisa mudar junto — é o custo de testar sem toolchain.
 *
 * Uso: node bench/test-repetition.mjs
 */

// --- cópia fiel de generator.ts:isTooSimilar -------------------------------
function isTooSimilar(a, b) {
  const norm = (s) =>
    (s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const wordsX = new Set(x.split(" "));
  const wordsY = new Set(y.split(" "));
  const inter = [...wordsX].filter((w) => wordsY.has(w)).length;
  const union = new Set([...wordsX, ...wordsY]).size;
  return union > 0 && inter / union >= 0.8;
}

// --- cópia fiel de engine.ts:markRepetitions -------------------------------
function markRepetitions(replies, against = []) {
  const seen = [...against];
  const flags = [];
  for (const reply of replies) {
    const duplicated = seen.some((prev) => isTooSimilar(prev, reply));
    flags.push(duplicated);
    seen.push(reply);
  }
  return flags;
}

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ok   ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}`);
  }
}

console.log("isTooSimilar");
check("idênticas → true", isTooSimilar("Obrigada pelo carinho!", "Obrigada pelo carinho!") === true);
check("só acento/caixa difere → true", isTooSimilar("Obrigada!", "obrigada") === true);
check("curta x curta, parcial → false", isTooSimilar("Obrigada pelo carinho!", "Obrigada!") === false);
check("vazia → false", isTooSimilar("", "oi") === false);
check("frases distintas → false", isTooSimilar("Que bom que gostou!", "Volte sempre por aqui") === false);

console.log("markRepetitions (dentro da leva)");
// O caso real: 10 comentários "linda" — a 1ª passa, as seguintes são repetição.
const batch = ["Que carinho, obrigada!", "Que carinho, obrigada!", "Que carinho, obrigada!"];
const flags = markRepetitions(batch);
check("primeira não é repetição", flags[0] === false);
check("segunda é repetição", flags[1] === true);
check("terceira é repetição", flags[2] === true);

console.log("markRepetitions (contra o histórico já enviado)");
// Sem o segundo argumento isto falhava: a sugestão nova era idêntica a uma já
// enviada e mesmo assim passava como original.
const against = ["Muito obrigada pelo carinho!"];
const f2 = markRepetitions(["Muito obrigada pelo carinho!"], against);
check("idêntica a uma já usada → repetição", f2[0] === true);

const f3 = markRepetitions(["Obrigada por acompanhar!"], ["Muito obrigada pelo carinho!"]);
check("diferente do histórico → não repetição", f3[0] === false);

console.log("markRepetitions (sem histórico)");
const f4 = markRepetitions(["única sugestão"]);
check("lista de 1 → não repetição", f4[0] === false);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed === 0 ? 0 : 1);
