import { pathToFileURL } from 'node:url';

/** Dedicated process, never part of a Vercel function or a browser session. */
export async function tickScheduler({ enabled, origin, secret, request = fetch, signal }) {
  if (!enabled) return { status: 'disabled', processed: 0 };
  const target = new URL(origin);
  if (target.protocol !== 'https:' || target.username || target.password || target.port || target.pathname !== '/' || target.search || target.hash || !target.hostname.includes('.')) throw new Error('Explicit HTTPS deployment origin required');
  if (typeof secret !== 'string' || secret.length < 32 || /\s/.test(secret)) throw new Error('Dedicated scheduler secret required');
  const timeout = AbortSignal.timeout(290_000);
  const response = await request(new URL('/api/cron/publishing', target), {
    method: 'GET', headers: { Authorization: `Bearer ${secret}` }, redirect: 'error',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error(`Publishing worker HTTP ${response.status}`);
  const result = await response.json();
  if (result.enabled === false) return { status: 'worker_disabled', processed: 0 };
  if (!Number.isSafeInteger(result.processed) || result.processed < 0) throw new Error('Invalid worker response');
  return { status: 'completed', processed: result.processed };
}
export async function runScheduler(config, { sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) { reject(signal.reason); return; }
  const stop = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, ms);
  signal?.addEventListener('abort', stop, { once: true });
}), log = console.log } = {}) {
  if (!config.enabled) { log('Publishing scheduler disabled; no requests made.'); return; }
  if (!Number.isFinite(config.intervalMs) || config.intervalMs < 60_000) throw new Error('Minimum scheduler interval is one minute');
  while (!config.signal?.aborted) {
    const started = Date.now();
    try {
      const result = await tickScheduler(config);
      log(JSON.stringify({ event: 'publishing_scheduler', status: result.status, processed: result.processed, elapsedMs: Date.now() - started }));
    } catch {
      // Never emit URLs, headers, response bodies or arbitrary provider messages.
      if (!config.signal?.aborted) log(JSON.stringify({ event: 'publishing_scheduler', status: 'failed', elapsedMs: Date.now() - started }));
    }
    if (config.signal?.aborted) break;
    try { await sleep(config.intervalMs, config.signal); } catch { break; }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stop = new AbortController();
  process.once('SIGINT', () => stop.abort()); process.once('SIGTERM', () => stop.abort());
  await runScheduler({ enabled: process.env.PUBLISHING_SCHEDULER_ENABLED === 'true',
    origin: process.env.PUBLISHING_SCHEDULER_ORIGIN, secret: process.env.CRON_SECRET,
    intervalMs: Number(process.env.PUBLISHING_SCHEDULER_INTERVAL_MS || 60_000), signal: stop.signal });
}
