/** Extract a human-readable message from an unknown caught value. */
export function formatError(err: unknown): string {
  if (err != null && typeof err === "object") {
    // Apollo GraphQL errors: prefer the first server-side error message
    const gqlErrors = (err as Record<string, unknown>).graphQLErrors;
    if (Array.isArray(gqlErrors) && gqlErrors.length > 0 && gqlErrors[0].message) {
      return gqlErrors[0].message;
    }
    if (err instanceof Error) return err.message;
  }
  return String(err);
}

/** Bi-directional image MIME ↔ extension mappings. */
export const IMAGE_EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

export const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/bmp": ".bmp",
};
