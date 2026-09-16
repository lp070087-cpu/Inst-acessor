"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * RENDERIZADOR MARKDOWN MÍNIMO E SEGURO
 * =====================================
 * A IA responde em Markdown (negrito, listas, passos, subtítulos). Antes, esse
 * texto era despejado cru na tela e o usuário via literalmente `**texto**` e
 * `### título`.
 *
 * Por que não instalar uma biblioteca de Markdown:
 *   - quase todas produzem HTML via `dangerouslySetInnerHTML`, o que exige
 *     sanitização (superfície de risco desnecessária para uma resposta de chat);
 *   - o subconjunto que a IA realmente usa é pequeno.
 *
 * AQUI NÃO EXISTE HTML. O texto é quebrado em pedaços e cada pedaço vira um
 * ELEMENTO React (string ou tag). Ou seja: qualquer coisa parecida com HTML que
 * venha do modelo — `<script>`, `<img onerror=...>` — é renderizada como TEXTO
 * VISÍVEL pelo próprio React. Não há caminho para injeção.
 *
 * Suportado: `## título`, `### subtítulo`, `**negrito**`, `*itálico*`,
 * `` `código` ``, blocos cercados por ``` ``` ```, listas com `-`/`*`/`•`,
 * listas numeradas `1.`, citações `>` e parágrafos separados por linha em
 * branco.
 */

type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string }
  | { kind: "divider" };

/** Divide o texto bruto em blocos. Determinístico e sem regex recursiva. */
function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  // Uniformiza quebras e remove espaços no fim de cada linha.
  const lines = source.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));

  let ul: string[] = [];
  let ol: string[] = [];
  let paragraph: string[] = [];
  // BLOCO 5 — a cerca de código (```) atravessa várias linhas, por isso o
  // estado precisa sobreviver ao laço. Sem isso, um bloco de código virava
  // dezenas de parágrafos soltos e cada linha longa esticava a bolha.
  let inCode = false;
  let codeLines: string[] = [];

  const flushList = () => {
    if (ul.length > 0) {
      blocks.push({ kind: "ul", items: ul });
      ul = [];
    }
    if (ol.length > 0) {
      blocks.push({ kind: "ol", items: ol });
      ol = [];
    }
  };
  const flushParagraph = () => {
    if (paragraph.length > 0) {
      // Linhas soltas dentro de um parágrafo viram texto corrido: a IA às vezes
      // separa frases com uma quebra simples, e mostrar cada uma como bloco
      // próprio deixaria a resposta esfarelada.
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushAll = () => {
    flushList();
    flushParagraph();
  };

  for (const raw of lines) {
    const line = raw.trim();

    // Cerca de código no fim: fecha o bloco com o que já foi acumulado.
    if (inCode && /^```/.test(line)) {
      blocks.push({ kind: "code", text: codeLines.join("\n") });
      codeLines = [];
      inCode = false;
      continue;
    }
    // Todo o resto do bloco de código é texto literal — nada de markdown aqui.
    if (inCode) {
      codeLines.push(raw);
      continue;
    }
    // Cerca de código no início: consome a linguagem informada e abre o bloco.
    if (/^```/.test(line)) {
      flushAll();
      inCode = true;
      codeLines = [];
      continue;
    }

    if (line === "") {
      flushAll();
      continue;
    }

    // Régua horizontal
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushAll();
      blocks.push({ kind: "divider" });
      continue;
    }

    // Títulos (### antes de ## para casar o mais específico primeiro)
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length >= 3 ? 3 : 2;
      blocks.push({ kind: "heading", level, text: heading[2].trim() });
      continue;
    }

    // Citação
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushAll();
      blocks.push({ kind: "quote", text: quote[1].trim() });
      continue;
    }

    // Lista numerada: "1. ", "2) "
    const ordered = /^(\d{1,3})[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      flushParagraph();
      if (ul.length > 0) {
        blocks.push({ kind: "ul", items: ul });
        ul = [];
      }
      ol.push(ordered[2].trim());
      continue;
    }

    // Lista com marcador: "- ", "* ", "• "
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (ol.length > 0) {
        blocks.push({ kind: "ol", items: ol });
        ol = [];
      }
      ul.push(bullet[1].trim());
      continue;
    }

    // Linha comum → parágrafo
    flushList();
    paragraph.push(line);
  }

  // Cerca aberta e nunca fechada: mostra o que veio, em vez de descartar.
  if (inCode && codeLines.length > 0) {
    blocks.push({ kind: "code", text: codeLines.join("\n") });
  }

  flushAll();
  return blocks;
}

/**
 * Converte marcações inline em elementos React.
 * Retorna um array de nós — nunca uma string de HTML.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Ordem importa: `**negrito**` antes de `*itálico*`, senão o negrito casaria
  // como itálico + asterisco solto.
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      nodes.push(
        // BLOCO 5 — `[overflow-wrap:anywhere]` permite quebrar um token longo
        // (URL, hash, nome de coluna) DENTRO da própria resposta. Sem isso o
        // trecho não quebrava, esticava a bolha e criava rolagem horizontal.
        <code
          key={key}
          className="rounded-[6px] bg-surface px-1.5 py-0.5 font-mono text-[0.92em] text-ink-soft [overflow-wrap:anywhere]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else {
      nodes.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export interface MarkdownLiteProps {
  content: string;
  className?: string;
}

export function MarkdownLite({ content, className }: MarkdownLiteProps) {
  const blocks = React.useMemo(() => parseBlocks(content), [content]);

  return (
    <div className={cn("flex flex-col gap-2.5 [&>*:first-child]:mt-0", className)}>
      {blocks.map((block, index) => {
        const key = `b${index}`;

        switch (block.kind) {
          case "heading":
            return block.level === 2 ? (
              <h4
                key={key}
                className="font-display text-[14.5px] font-bold text-ink mt-1.5 first:mt-0"
              >
                {renderInline(block.text, key)}
              </h4>
            ) : (
              <h5
                key={key}
                className="text-[13.5px] font-bold text-ink mt-1 first:mt-0"
              >
                {renderInline(block.text, key)}
              </h5>
            );

          case "ul":
            return (
              <ul key={key} className="flex flex-col gap-1.5 pl-1 my-0.5">
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`} className="flex gap-2.5 leading-relaxed">
                    <span aria-hidden className="text-purple font-bold flex-none select-none">
                      •
                    </span>
                    <span className="min-w-0 flex-1 break-words">{renderInline(item, `${key}-${j}`)}</span>
                  </li>
                ))}
              </ul>
            );

          case "ol":
            return (
              <ol key={key} className="flex flex-col gap-1.5 pl-1 my-0.5">
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`} className="flex gap-2.5 leading-relaxed">
                    <span
                      aria-hidden
                      className="flex-none w-5 h-5 rounded-full bg-ai-soft text-purple text-[11.5px] font-bold grid place-items-center mt-[1px] select-none"
                    >
                      {j + 1}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{renderInline(item, `${key}-${j}`)}</span>
                  </li>
                ))}
              </ol>
            );

          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-2 border-purple/40 pl-3 text-ink-soft italic my-0.5"
              >
                {renderInline(block.text, key)}
              </blockquote>
            );

          case "code":
            return (
              // BLOCO 5 — o código rola DENTRO do próprio bloco. `max-w-full`
              // + `overflow-x-auto` e a linha em `w-max min-w-full ... nowrap`
              // garantem que a página nunca cresça por causa do trecho; é o
              // bloco que tem barra de rolagem, não o documento.
              <pre
                key={key}
                className="max-w-full overflow-x-auto rounded-[10px] bg-surface border border-border-soft px-3 py-2.5 my-0.5"
              >
                <code className="block w-max min-w-full font-mono text-[12.5px] leading-relaxed text-ink-soft whitespace-pre">
                  {block.text}
                </code>
              </pre>
            );

          case "divider":
            return <hr key={key} className="border-border-soft my-1" />;

          default:
            return (
              <p key={key} className="leading-relaxed">
                {renderInline(block.text, key)}
              </p>
            );
        }
      })}
    </div>
  );
}

/** Resumo em texto puro — para contextos que não aceitam elementos (preview, título). */
export function markdownToPlainText(source: string): string {
  return source
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/^\d{1,3}[.)]\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
