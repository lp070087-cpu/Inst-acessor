import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { isPublicMediaUrl } from "./media";

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !([0, 10, 127].includes(a) || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0 || b === 2)) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0));
  }
  // Only global-unicast IPv6, excluding documentation addresses and mappings.
  return isIP(address) === 6 && /^[23]/i.test(address) && !address.toLowerCase().startsWith("2001:db8:");
}

/** Resolve once and pin the verified address; do not follow redirects. */
export async function probePublicMedia(raw: string): Promise<boolean> {
  if (!isPublicMediaUrl(raw)) return false;
  try {
    const url = new URL(raw);
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) return false;
    const pinned = addresses[0];
    return await new Promise<boolean>((resolve) => {
      const req = request(url, {
        method: "GET", headers: { Range: "bytes=0-31" },
        lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
      }, (res) => {
        const ok = (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
        res.destroy();
        resolve(ok);
      });
      req.setTimeout(15_000, () => req.destroy(new Error("Media probe timeout")));
      req.on("error", () => resolve(false));
      req.end();
    });
  } catch { return false; }
}

/** Bounded signature inspection, pinned DNS, no redirect or full-file buffering. */
export async function readPublicMediaPrefix(raw: string): Promise<Buffer | null> {
  if (!isPublicMediaUrl(raw)) return null;
  try {
    const url = new URL(raw);
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) return null;
    const pinned = addresses[0];
    return await new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let length = 0;
      let done = false;
      const finish = (value: Buffer | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        req.destroy();
        resolve(value);
      };
      const req = request(url, {
        method: "GET", headers: { Range: "bytes=0-31" },
        lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
      }, (res) => {
        if (![200, 206].includes(res.statusCode ?? 0)) { res.destroy(); finish(null); return; }
        res.on("data", (chunk: Buffer) => {
          const bounded = chunk.subarray(0, 32 - length);
          chunks.push(bounded); length += bounded.length;
          if (length >= 32) { res.destroy(); finish(Buffer.concat(chunks)); }
        });
        res.on("end", () => finish(Buffer.concat(chunks)));
        res.on("error", () => finish(null));
      });
      const timer = setTimeout(() => finish(null), 15000);
      req.on("error", () => finish(null));
      req.end();
    });
  } catch { return null; }
}
