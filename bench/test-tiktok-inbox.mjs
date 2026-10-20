import assert from "node:assert/strict";
import { normalizeTikTokEvent, processTikTokInbox } from "../src/lib/integrations/tiktok/webhook-inbox.ts";
globalThis.fetch = async () => { throw new Error("Network prohibited"); };
let checks = 0;
const check = (value) => { assert.ok(value); checks++; };
const base = { client_key: "synthetic-client", event: "authorization.removed", create_time: 1700000000, user_openid: "synthetic-openid", content: JSON.stringify({ reason: 1, email: "private@fixture.invalid", token: "do-not-store" }) };
const first = normalizeTikTokEvent(JSON.stringify(base), base.client_key);
const second = normalizeTikTokEvent(JSON.stringify({ ...base, content: '{"reason":1}' }, null, 2), base.client_key);
check(first.eventKey === second.eventKey);
check(first.rawHash !== second.rawHash);
check(first.accountHash.length === 64);
check(!JSON.stringify({ ...first, accountId: undefined }).includes("fixture.invalid"));
check(!JSON.stringify(first).includes("do-not-store"));
check(normalizeTikTokEvent(JSON.stringify({ ...base, event: "post.publish.complete" }), base.client_key).eventName === "post.publish.complete");
for (const patch of [ { client_key: "wrong-client" }, { event: "log\ninjection" }, { create_time: Number.MAX_SAFE_INTEGER }, { create_time: -1 }, { content: "not-json" }, { content: '{"reason":99}' }, { user_openid: "" } ]) {
  assert.throws(() => normalizeTikTokEvent(JSON.stringify({ ...base, ...patch }), base.client_key)); checks++;
}
assert.throws(() => normalizeTikTokEvent("x".repeat(128 * 1024 + 1), base.client_key)); checks++;
delete process.env.SOCIAL_WEBHOOK_WORKER_ENABLED;
check((await processTikTokInbox()).enabled === false);
console.log(`${checks} TikTok normalized inbox checks passed (no DB or provider).`);
