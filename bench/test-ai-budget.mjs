import assert from "node:assert/strict";
import { capSystem, capMessages, AI_MAX_SYSTEM_CHARS, AI_MAX_MESSAGE_CHARS, AI_MAX_INPUT_CHARS } from "../src/lib/ai/limits.ts";

globalThis.fetch = async () => { throw new Error("Network is forbidden in this pure test"); };
let checks = 0;
const check = (value) => { assert.ok(value); checks++; };
check(capSystem(undefined) === undefined);
check(capSystem("unchanged") === "unchanged");
const system = "s".repeat(AI_MAX_SYSTEM_CHARS + 100);
check(capSystem(system).length === AI_MAX_SYSTEM_CHARS);
check(capSystem(system).endsWith("[contexto truncado]"));
const messages = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `${i}:` + "m".repeat(AI_MAX_MESSAGE_CHARS + 100) }));
const original = JSON.stringify(messages);
for (const prompt of [undefined, "", "short system", system]) {
  const capped = capMessages(messages, prompt);
  check(capped.every((message) => message.content.length <= AI_MAX_MESSAGE_CHARS));
  check(capped.reduce((total, message) => total + message.content.length, capSystem(prompt)?.length ?? 0) <= AI_MAX_INPUT_CHARS);
  check(capped.at(-1).content.startsWith("19:"));
  check(capped.every((message, i) => i === 0 || Number.parseInt(message.content) > Number.parseInt(capped[i - 1].content)));
}
check(JSON.stringify(messages) === original);
check(capMessages([{ role: "user", content: "small" }], "system")[0].content === "small");
check(capMessages([], system).length === 0);
// Exercise both real request builders with an in-memory transport. This checks
// the complete serialized request boundary without calling a paid provider.
const { OpenAIProvider } = await import("../src/lib/ai/openai.ts");
const { GeminiProvider } = await import("../src/lib/ai/gemini.ts");
for (const Provider of [OpenAIProvider, GeminiProvider]) {
  let request;
  globalThis.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: "fixture" } }], candidates: [{ content: { parts: [{ text: "fixture" }] } }] }) };
  };
  const provider = new Provider("synthetic-key", "synthetic-model");
  check(await provider.complete({ system, messages }) === "fixture");
  const length = request.messages
    ? request.messages.reduce((sum, message) => sum + message.content.length, 0)
    : request.contents.reduce((sum, message) => sum + message.parts.reduce((n, part) => n + part.text.length, 0), 0);
  check(length <= AI_MAX_INPUT_CHARS);
}
globalThis.fetch = async () => { throw new Error("Network is forbidden in this pure test"); };
console.log(`AI input budgets: ${checks} checks passed (pure; no provider call).`);
