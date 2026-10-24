import assert from "node:assert/strict";
import { extractCheckoutUrl, getAsaasCheckoutOrigin } from "../src/lib/billing/asaas/hosted-checkout.ts";

globalThis.fetch = async () => { throw new Error("Network is forbidden in this pure test"); };
let checks = 0;
const check = (response, expected, config) => {
  assert.equal(extractCheckoutUrl({ id: "synthetic-checkout", ...response }, config), expected);
  checks++;
};
const production = "https://asaas.com/checkoutSession/show?id=synthetic-checkout";
const sandbox = "https://sandbox.asaas.com/checkoutSession/show?id=synthetic-checkout";
check({ status: "ACTIVE", link: production }, production);
check({ link: `  ${sandbox}  ` }, sandbox);
check({ link: "", url: production }, production);
check({ link: "invalid", url: "", checkoutUrl: sandbox }, sandbox);
check({ link: 123, url: production }, production);
for (const url of [
  "javascript:alert(1)", "http://asaas.com/checkoutSession/show?id=x",
  "https://asaas.com.evil.test/checkoutSession/show?id=x",
  "https://evil.test/checkoutSession/show?id=x",
  "https://user:secret@asaas.com/checkoutSession/show?id=x",
  "https://asaas.com:444/checkoutSession/show?id=x",
  "https://asaas.com/redirect?id=x", "https://asaas.com/checkoutSession/show",
  "https://asaas.com/checkoutSession/show?id=x&redirect=https://evil.test",
  "https://asaas.com/checkoutSession/show?id=x#secret",
]) check({ link: url }, null);
check({ link: "https://evil.test", url: production }, production);
check({}, null); // An id-only response needs environment-specific verification.
const sandboxConfig = { baseUrl: "https://api-sandbox.asaas.com/v3", checkoutOrigin: "https://sandbox.asaas.com" };
const productionConfig = { baseUrl: "https://api.asaas.com/v3", checkoutOrigin: "https://asaas.com" };
check({}, sandbox, sandboxConfig);
check({}, production, productionConfig);
check({}, null, { baseUrl: sandboxConfig.baseUrl });
check({}, null, { ...sandboxConfig, checkoutOrigin: productionConfig.checkoutOrigin });
check({}, null, { ...productionConfig, checkoutOrigin: sandboxConfig.checkoutOrigin });
check({}, null, { ...sandboxConfig, baseUrl: "https://api-sandbox.asaas.com.evil.test/v3" });
check({}, null, { ...sandboxConfig, checkoutOrigin: "https://sandbox.asaas.com/redirect" });
check({}, null, { ...sandboxConfig, checkoutOrigin: "https://user:secret@sandbox.asaas.com" });
check({ link: production }, null, { baseUrl: sandboxConfig.baseUrl });
check({ link: sandbox }, sandbox, { baseUrl: sandboxConfig.baseUrl });
check({ id: "../../other" }, null, sandboxConfig);
check({ link: "https://asaas.com/checkoutSession/show?id=a&id=b" }, null);
// The exact same pure preflight applies before creating Sandbox or Production orders.
const preflight = (config, expected, sandboxOnly = false) => { assert.equal(getAsaasCheckoutOrigin(config, sandboxOnly), expected); checks++; };
preflight(sandboxConfig, "https://sandbox.asaas.com");
preflight(productionConfig, "https://asaas.com");
preflight({ ...productionConfig, checkoutOrigin: "https://www.asaas.com/" }, "https://www.asaas.com");
preflight({ ...sandboxConfig, baseUrl: `${sandboxConfig.baseUrl}/` }, "https://sandbox.asaas.com");
preflight({ baseUrl: sandboxConfig.baseUrl }, null);
preflight({ baseUrl: productionConfig.baseUrl }, null);
preflight({ ...sandboxConfig, checkoutOrigin: productionConfig.checkoutOrigin }, null);
preflight({ ...productionConfig, checkoutOrigin: sandboxConfig.checkoutOrigin }, null);
for (const invalid of ["http://sandbox.asaas.com", "https://sandbox.asaas.com.evil.invalid", "https://user:password@sandbox.asaas.com", "https://sandbox.asaas.com:444", "https://sandbox.asaas.com/checkoutSession/show", "https://sandbox.asaas.com?redirect=elsewhere", "https://sandbox.asaas.com#fragment", "not-a-url"]) {
  preflight({ ...sandboxConfig, checkoutOrigin: invalid }, null);
}
for (const invalid of ["https://api.asaas.com/v3?redirect=other", "http://api-sandbox.asaas.com/v3", "https://api-sandbox.asaas.com.evil.invalid/v3", "https://api-sandbox.asaas.com/v4"]) {
  preflight({ ...sandboxConfig, baseUrl: invalid }, null);
}
preflight(productionConfig, null, true);
preflight(sandboxConfig, "https://sandbox.asaas.com", true);
preflight(productionConfig, "https://asaas.com", false);
// The effective URL overrides labels: a Sandbox label cannot permit Production in Preview.
preflight({ ...productionConfig, environment: "sandbox" }, null, true);
preflight({ ...sandboxConfig, environment: "production" }, "https://sandbox.asaas.com", true);
console.log(`Asaas checkout aliases: ${checks} checks passed (pure; no checkout created).`);
