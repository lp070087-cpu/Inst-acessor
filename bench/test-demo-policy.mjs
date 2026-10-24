import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/demo-policy.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { isLocalDemoAllowed: allowed } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const dev = { NODE_ENV: 'development', INST_DEMO_MODE: '1' };
for (const host of ['127.0.0.1:3107', 'localhost:3107', '[::1]:3107']) assert.equal(allowed(dev, host), true);
for (const mode of ['production', 'test', undefined]) assert.equal(allowed({ ...dev, NODE_ENV: mode }, '127.0.0.1:3107'), false);
for (const flag of ['0', '', undefined]) assert.equal(allowed({ ...dev, INST_DEMO_MODE: flag }, '127.0.0.1:3107'), false);
for (const value of ['1', '0', '']) assert.equal(allowed({ ...dev, VERCEL: value }, '127.0.0.1:3107'), false);
for (const host of [null, '', 'example.com', '127.0.0.1.evil:3107', 'localhost@evil:3107', 'localhost:3000', '192.168.1.1:3107']) assert.equal(allowed(dev, host), false);
console.log('Demo policy: production/test, flag, Vercel and non-loopback hosts blocked; local development allowed.');
