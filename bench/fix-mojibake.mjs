#!/usr/bin/env node
/**
 * CORREÇÃO DE MOJIBAKE POR SEQUÊNCIA (segura para arquivos MISTOS)
 * ===============================================================
 * Alguns arquivos têm trechos gravados como UTF-8, lidos como Windows-1252 e
 * regravados como UTF-8. "evolução" virou "evoluÃ§Ã£o"; o travessão "—" virou
 * "â€"".
 *
 * POR QUE NÃO CONVERTER O ARQUIVO INTEIRO: alguns desses arquivos estão MISTOS
 * — parte do texto já está em UTF-8 correto e parte está dobrada. Reverter o
 * arquivo inteiro como cp1252 corromperia a parte correta (um "ã" legítimo,
 * que é 2 bytes em UTF-8, seria reduzido a 1 byte). Aqui trocamos APENAS as
 * sequências conhecidas de mojibake — o que já está certo nunca é tocado.
 *
 * SEM --apply = dry-run (não escreve). Rode e confira o antes/depois.
 *
 * Uso:
 *   node bench/fix-mojibake.mjs <arquivo>            # dry-run
 *   node bench/fix-mojibake.mjs <arquivo> --apply    # grava
 */

import { readFileSync, writeFileSync } from "node:fs";

// Sequências de mojibake → caractere certo. Ordem importa: as mais longas
// (com mais caracteres) vêm primeiro para não serem quebradas pelas curtas.
// Só entram aqui padrões INEQUÍVOCOS — combinações que não ocorrem em
// português normal.
const PAIRS = [
  // travessão e aspas tipográficas (a marca do cp1252: 0x97 → "—")
  ["â€”", "—"], // â€” → —
  ["â€“", "“"], // â€œ → “
  ["â€\u009d", "”"], // â€   → ”
  ["â€™", "’"], // â€™ → ’
  ["â€˜", "‘"], // â€˜ → ‘
  ["â€¦", "…"], // â€¦ → …
  ["â€¢", "•"], // â€¢ → •
  ["â€–", "–"], // â€“ → –
  ["Ã—", "×"],       // Ã— → ×
  // letras acentuadas — maiúsculas primeiro
  ["Ã\u0083", "Ã"], // Ãƒ → Ã
  ["Ã‡", "Ç"], // Ã‡ → Ç
  ["Ã\u0089", "É"], // Ã‰ → É
  ["Ã\u0081", "Á"], // Ã   → Á
  ["Ã\u0093", "Ó"], // Ã“ → Ó
  ["Ã\u009a", "Ú"], // Ãš → Ú
  ["Ã\u008a", "Ê"], // ÃŠ → Ê
  ["Ã\u0094", "Ô"], // Ã” → Ô
  ["Ã…", "Å"], // Ã… → Å
  // minúsculas
  ["Ã§", "ç"], // Ã§ → ç
  ["Ã£", "ã"], // Ã£ → ã
  ["Ã©", "é"], // Ã© → é
  ["Ã¡", "á"], // Ã¡ → á
  ["Ã­", "í"], // Ã  → í
  ["Ã³", "ó"], // Ã³ → ó
  ["Ãº", "ú"], // Ãº → ú
  ["Ã¢", "â"], // Ã¢ → â
  ["Ãª", "ê"], // Ãª → ê
  ["Ã´", "ô"], // Ã´ → ô
  ["Ãµ", "õ"], // Ãµ → õ
  ["Ã ", "à"], // Ã  → à
  ["Ã¨", "è"], // Ã¨ → è
  ["Ã¼", "ü"], // Ã¼ → ü
  ["Ã¤", "ä"], // Ã¤ → ä
  ["Ã±", "ñ"], // Ã± → ñ
];

const [, , file, ...flags] = process.argv;
if (!file) {
  console.error("Uso: node bench/fix-mojibake.mjs <arquivo> [--apply]");
  process.exit(2);
}
const apply = flags.includes("--apply");

const original = readFileSync(file, "utf8");
let fixed = original;
let count = 0;
for (const [bad, good] of PAIRS) {
  while (fixed.includes(bad)) {
    fixed = fixed.replace(bad, good);
    count++;
  }
}

if (count === 0) {
  console.log(`${file}: nenhuma sequência de mojibake encontrada.`);
  process.exit(0);
}

// Mostra as primeiras linhas afetadas para conferência.
const before = original.split(/\r?\n/);
const after = fixed.split(/\r?\n/);
let shown = 0;
let lines = 0;
for (let i = 0; i < before.length; i++) {
  if (before[i] !== after[i]) {
    lines++;
    if (shown < 10) {
      shown++;
      console.log(`  L${i + 1}\n    - ${before[i]}\n    + ${after[i]}`);
    }
  }
}
console.log(`${file}: ${count} sequência(s) em ${lines} linha(s).`);

if (apply) {
  writeFileSync(file, fixed, "utf8");
  console.log(`Gravado: ${file}`);
} else {
  console.log("(dry-run — rode com --apply para gravar)");
}
