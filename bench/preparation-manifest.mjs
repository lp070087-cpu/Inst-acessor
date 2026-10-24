// Local review only; never reads ignored env files or prints matching secrets.
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
if (git(['branch', '--show-current']).trim() !== 'audit/finalizacao-inst-acessor') throw new Error('Wrong branch');
const files = [...new Set([...git(['diff', '--name-only', 'HEAD', '-z']).split('\0'), ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0')].filter(Boolean))].sort();
const approvedRoot = new Set(['AGENTS.md', '.gitattributes', '.gitignore', '.vercelignore', 'vercel.json', 'next.config.mjs', 'package.json', 'package-lock.json', 'tsconfig.json']);
const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /\bgh[pousr]_[A-Za-z0-9]{30,}/, /\bgithub_pat_[A-Za-z0-9_]{30,}/, /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/, /\bAIza[A-Za-z0-9_-]{30,}/, /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@(?!127\.0\.0\.1|localhost|\[::1\])[^\s]+/];
const entries = [];
for (const file of files) {
  if (!approvedRoot.has(file) && !/^(src|bench|prisma|docs|\.github|\.agents|scripts)\//.test(file)) throw new Error(`Unreviewed path: ${file}`);
  if (/(^|\/)\.env|session.*\.json$|storage-state|\.pem$|\.key$|\.log$|\.tsbuildinfo$/.test(file)) throw new Error(`Private artifact excluded: ${file}`);
  const path = resolve(root, file), stat = lstatSync(path);
  if (!stat.isFile() || stat.size > 5 * 1024 * 1024) throw new Error(`Unexpected file: ${file}`);
  const data = readFileSync(path);
  if (patterns.some(pattern => pattern.test(data.toString('utf8')))) throw new Error(`Potential secret in ${file}; matching value withheld`);
  entries.push({ path: file, sha256: createHash('sha256').update(data).digest('hex') });
}
mkdirSync(resolve(root, 'outputs/verification'), { recursive: true });
writeFileSync(resolve(root, 'outputs/verification/preparation-files.json'), JSON.stringify({ generatedAt: new Date().toISOString(), branch: 'audit/finalizacao-inst-acessor', base: git(['rev-parse', 'HEAD']).trim(), limitedPatternScan: 'PASS; not a complete secret detection guarantee', entries }, null, 2));
console.log(`${entries.length} candidate files checked; no env/session artifacts or high-confidence secret patterns detected. No staging/push performed.`);
