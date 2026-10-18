export const UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];

export function isOwnedUploadPath(pathname: string, userId: string): boolean {
  const prefix = `inst-acessor/${userId}/`;
  return pathname.startsWith(prefix) && pathname.length > prefix.length &&
    /^[a-zA-Z0-9._/-]+$/.test(pathname) &&
    pathname.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/** Validate the URL itself even when the client also supplies a pathname. */
export function ownedBlobPath(raw: string, userId: string, claimedPath?: string | null): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash ||
      !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i.test(url.hostname)) return null;
    const pathname = url.pathname.slice(1);
    if (!isOwnedUploadPath(pathname, userId) || (claimedPath && claimedPath !== pathname)) return null;
    return pathname;
  } catch { return null; }
}

export function mediaSignatureMatches(bytes: Uint8Array, mime: string): boolean {
  const b = Buffer.from(bytes);
  if (mime === "image/jpeg") return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === "image/png") return b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === "image/webp") return b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP";
  if (mime === "video/mp4" || mime === "video/quicktime") {
    return b.length >= 12 && b.toString("ascii", 4, 8) === "ftyp" &&
      (mime === "video/quicktime" ? b.toString("ascii", 8, 12) === "qt  " : /^(isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV|dash)$/.test(b.toString("ascii", 8, 12)));
  }
  return false;
}
