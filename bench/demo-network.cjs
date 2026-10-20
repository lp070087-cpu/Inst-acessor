// Preload ONLY for the isolated local demo process and its Node children.
const net = require('node:net');
const tls = require('node:tls');
const fs = require('node:fs');
const path = require('node:path');
const { syncBuiltinESMExports } = require('node:module');
const local = host => ['127.0.0.1', '::1', '[::1]', 'localhost'].includes(host);
function hostOf(args) {
  if (Array.isArray(args[0])) return hostOf(args[0]);
  const first = args[0];
  if (first && typeof first === 'object') return first.hostname || first.host || (first.path ? '__pipe__' : 'localhost');
  if (typeof first === 'number') return typeof args[1] === 'string' ? args[1] : 'localhost';
  return '__unknown__';
}
function guard(args) {
  if (!local(hostOf(args))) throw new Error('DEMO_OFFLINE: non-loopback socket blocked');
}
const socketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) { guard(args); return socketConnect.apply(this, args); };
for (const mod of [net, tls]) {
  for (const name of ['connect', 'createConnection']) {
    if (typeof mod[name] !== 'function') continue;
    const original = mod[name];
    mod[name] = function (...args) { guard(args); return original.apply(this, args); };
  }
}
const fetchOriginal = globalThis.fetch;
globalThis.fetch = function (input, options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!local(url.hostname)) return Promise.reject(new Error('DEMO_OFFLINE: external fetch blocked'));
  return fetchOriginal(input, options);
};
// __NEXT_PROCESSED_ENV alone skips parsing but loadEnvConfig still reads files.
// Hide .env* from the loader and deny direct reads, without reading their contents.
function secretPath(value) {
  if (value instanceof URL) value = require('node:url').fileURLToPath(value);
  return (typeof value === 'string' || Buffer.isBuffer(value)) && /^\.env(?:\.|$)/.test(path.basename(String(value)));
}
function denied(value) {
  const error = new Error('DEMO_ISOLATION: environment file unavailable');
  error.code = 'ENOENT';
  return error;
}
for (const name of ['statSync', 'lstatSync', 'readFileSync', 'openSync', 'createReadStream']) {
  const original = fs[name];
  fs[name] = function (file, ...args) { if (secretPath(file)) throw denied(file); return original.call(this, file, ...args); };
}
const exists = fs.existsSync;
fs.existsSync = function (file) { return secretPath(file) ? false : exists.call(this, file); };
for (const name of ['stat', 'lstat', 'readFile', 'open']) {
  const original = fs[name];
  fs[name] = function (file, ...args) {
    if (secretPath(file)) { const callback = args.at(-1); if (typeof callback === 'function') return queueMicrotask(() => callback(denied(file))); throw denied(file); }
    return original.call(this, file, ...args);
  };
  const originalPromise = fs.promises[name];
  fs.promises[name] = async function (file, ...args) { if (secretPath(file)) throw denied(file); return originalPromise.call(this, file, ...args); };
}
syncBuiltinESMExports();
