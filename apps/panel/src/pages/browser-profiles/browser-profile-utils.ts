export function validateProxyUrl(url: string): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function parseTags(tagString: string): string[] {
  return tagString
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
