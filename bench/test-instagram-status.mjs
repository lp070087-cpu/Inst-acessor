import './db-guard.mjs';
import assert from 'node:assert/strict';
import { mapInstagramStatus, verifiedInstagramMedia } from '../src/lib/publishing/media.ts';
// Contract references: Meta-owned Postman Get IG Container Status (FINISHED is ready)
// and facebook/facebook-nodejs-business-sdk/src/objects/ig-media.js (media fields).
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; console.log(`ok ${label}`); };
check(mapInstagramStatus('FINISHED') === 'PROCESSING', 'FINISHED is ready, never published');
check(mapInstagramStatus('PUBLISHED') === 'LIVE', 'PUBLISHED identifies published container');
for (const status of ['IN_PROGRESS', null, 'unexpected']) check(mapInstagramStatus(status) === 'PROCESSING', 'Unknown or pending container stays pending');
for (const status of ['ERROR', 'EXPIRED']) check(mapInstagramStatus(status) === 'ERROR', 'Failed container not live');
for (const status_code of ['FINISHED', 'PUBLISHED']) check(!verifiedInstagramMedia({ id: 'container', status_code }, 'container', 'owner'), 'Container ID cannot become media ID');
const media = { id: 'media', owner: { id: 'owner' }, media_type: 'VIDEO', permalink: 'https://www.instagram.com/reel/synthetic/', timestamp: '2026-10-18T12:00:00+0000' };
check(verifiedInstagramMedia(media, 'media', 'owner')?.externalId === 'media', 'Published owner media confirmed');
check(!verifiedInstagramMedia(media, 'different', 'owner'), 'Wrong media ID rejected');
check(!verifiedInstagramMedia(media, 'media', 'other'), 'Cross-account media rejected');
check(!verifiedInstagramMedia({ ...media, owner: undefined }, 'media', 'owner'), 'Missing owner fails closed');
check(!verifiedInstagramMedia({ ...media, timestamp: 'invalid' }, 'media', 'owner'), 'Missing publication timestamp rejected');
check(!verifiedInstagramMedia({ ...media, permalink: 'https://evil.invalid/post' }, 'media', 'owner'), 'Unexpected permalink rejected');
check(!verifiedInstagramMedia({ ...media, status_code: 'FINISHED' }, 'media', 'owner'), 'Media-shaped container cannot confirm');
console.log(`${checks} Instagram status assertions passed`);
