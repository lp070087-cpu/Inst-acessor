/** Pure policy: demo never overrides the real application's authentication. */
export function isLocalDemoAllowed(
  env: { NODE_ENV?: string; INST_DEMO_MODE?: string; VERCEL?: string },
  host: string | null,
): boolean {
  if (env.NODE_ENV !== "development" || env.INST_DEMO_MODE !== "1" || env.VERCEL !== undefined) return false;
  // Exact hosts only. No suffix matches, forwarded hosts, or user-supplied URLs.
  return host !== null && /^(127\.0\.0\.1|localhost|\[::1\])(?::3107)?$/.test(host);
}
