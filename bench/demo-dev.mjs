import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
if (basename(root) !== '.audit-worktree' || realpathSync(process.cwd()) !== root) throw new Error('Execute exclusivamente na raiz .audit-worktree.');
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
if (branch !== 'audit/finalizacao-inst-acessor') throw new Error('Branch incorreta; nenhuma troca automática será feita.');
const env = {};
for (const key of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'PATH', 'Path', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR', 'COMSPEC', 'ComSpec', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE']) {
  if (process.env[key]) env[key] = process.env[key];
}
Object.assign(env, {
  NODE_ENV: 'development', INST_DEMO_MODE: '1', NEXT_TELEMETRY_DISABLED: '1',
  NEXT_OUTPUT_DIR: '.next-demo', PUBLISHING_WORKER_ENABLED: 'false',
  DATABASE_URL: 'postgresql://demo:demo@127.0.0.1:1/demo?connect_timeout=1',
  DIRECT_URL: 'postgresql://demo:demo@127.0.0.1:1/demo?connect_timeout=1',
  NEXTAUTH_SECRET: 'isolated-local-demo-not-a-real-auth-secret',
  AUTH_URL: 'http://127.0.0.1:3107', NEXTAUTH_URL: 'http://127.0.0.1:3107',
  __NEXT_PROCESSED_ENV: 'true',
  NODE_OPTIONS: `--require "${resolve(root, 'bench/demo-network.cjs').replaceAll('\\', '/')}"`,
});
await new Promise((accept, reject) => {
  const probe = net.createServer();
  probe.once('error', () => reject(new Error('Porta 3107 indisponível; nenhum processo foi encerrado.')));
  probe.listen({ host: '127.0.0.1', port: 3107, exclusive: true }, () => probe.close(accept));
});
console.log('Demo local isolada: http://127.0.0.1:3107/demo/dashboard');
const child = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3107'], { cwd: root, env, stdio: 'inherit' });
child.once('error', () => { console.error('Não foi possível iniciar o Next local.'); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
