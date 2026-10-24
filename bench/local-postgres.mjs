import { spawn } from 'node:child_process';
import { platform, arch } from 'node:os';
import { dirname, resolve } from 'node:path';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { Client } from 'pg';

/** Manage only a newly created audit cluster; never discover or reuse a DB. */
export class LocalPostgres {
  constructor(databaseDir, port) { this.databaseDir = databaseDir; this.port = port; this.started = false; }
  async command(executable, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, { windowsHide: true, env: process.env });
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', (chunk) => { output += chunk; });
      const timer = setTimeout(() => { child.kill(); reject(new Error(`Audit PostgreSQL ${executable.split(/[\\/]/).pop()} timed out: ${output.slice(-1000)}`)); }, 60000);
      child.on('error', (error) => { clearTimeout(timer); reject(error); });
      child.on('exit', (code) => {
        clearTimeout(timer);
        child.stdout.destroy();
        child.stderr.destroy();
        code === 0 ? resolve(output) : reject(new Error(`Audit PostgreSQL command failed (${code}): ${output}`));
      });
    });
  }
  async initialise() {
    if (process.getuid?.() === 0) throw new Error('Run the disposable cluster as an unprivileged CI user');
    await new Promise((resolve, reject) => {
      const probe = createServer();
      probe.once('error', reject);
      probe.listen(this.port, '127.0.0.1', () => probe.close(resolve));
    });
    const binaries = await import(`@embedded-postgres/${platform() === 'win32' ? 'windows' : platform()}-${arch()}`);
    this.pgCtl = resolve(dirname(binaries.postgres), platform() === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
    const passwordFile = resolve(this.databaseDir, '..', `postgres-password-${Date.now()}.txt`);
    writeFileSync(passwordFile, 'audit\n', { mode: 0o600 });
    try {
      await this.command(binaries.initdb, ['-D', this.databaseDir, '-U', 'audit', '-A', 'scram-sha-256', '--pwfile', passwordFile, '--encoding=UTF8', '--locale=C', '--no-sync']);
    } finally { if (existsSync(passwordFile)) unlinkSync(passwordFile); }
  }
  async start() {
    await this.command(this.pgCtl, ['-D', this.databaseDir, '-l', resolve(this.databaseDir, 'server.log'), '-w', '-t', '30', 'start', '-o', `-h 127.0.0.1 -p ${this.port}`]);
    this.started = true;
  }
  async createDatabase(name) {
    if (!['inst_acessor_audit', 'inst_acessor_audit_migrations'].includes(name)) throw new Error('Audit database name required');
    const client = new Client({ host: '127.0.0.1', port: this.port, user: 'audit', password: 'audit', database: 'postgres', connectionTimeoutMillis: 5000 });
    await client.connect();
    try { await client.query(`CREATE DATABASE "${name}" ENCODING 'UTF8'`); } finally { await client.end(); }
  }
  async stop() {
    if (this.pgCtl && (this.started || existsSync(resolve(this.databaseDir, 'postmaster.pid')))) {
      await this.command(this.pgCtl, ['-D', this.databaseDir, '-m', 'fast', '-w', '-t', '30', 'stop']);
    }
    this.started = false;
  }
}
