export function isSameOriginMutation(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser API clients still need authentication.
  try {
    return origin === new URL(process.env.AUTH_URL || request.url).origin;
  } catch { return false; }
}
