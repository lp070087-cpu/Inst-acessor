// Preload for verification processes only. Never imported by application code.
const net = require('node:net');
const tls = require('node:tls');
const http = require('node:http');
const https = require('node:https');
const local = (host) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
function hostOf(args) {
  const first = args[0];
  if (typeof first === 'object' && first !== null) return first.host || first.hostname || 'localhost';
  if (typeof first === 'number') return typeof args[1] === 'string' ? args[1] : 'localhost';
  if (typeof first === 'string' && /^https?:/.test(first)) return new URL(first).hostname;
  return 'localhost';
}
for (const module of [net, tls]) {
  for (const key of ['connect', 'createConnection']) {
    if (typeof module[key] !== 'function') continue;
    const original = module[key];
    module[key] = function (...args) {
      if (!local(hostOf(args))) throw new Error('OFFLINE_GUARD: external socket denied');
      return original.apply(this, args);
    };
  }
}
for (const module of [http, https]) {
  for (const key of ['request', 'get']) {
    const original = module[key];
    module[key] = function (...args) {
      const first = args[0];
      const host = first instanceof URL ? first.hostname : hostOf(args);
      if (!local(host)) throw new Error('OFFLINE_GUARD: external HTTP denied');
      return original.apply(this, args);
    };
  }
}
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!local(url.hostname)) return Promise.reject(new Error('OFFLINE_GUARD: external fetch denied'));
  return originalFetch(input, options);
};
