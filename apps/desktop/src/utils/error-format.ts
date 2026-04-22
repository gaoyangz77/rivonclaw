const DEFAULT_MAX_ERROR_MESSAGE_LEN = 500;

function readErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") return code;
  if (typeof code === "number") return String(code);
  return undefined;
}

export function formatDetailedErrorMessage(err: unknown, maxLen = DEFAULT_MAX_ERROR_MESSAGE_LEN): string {
  if (!err) return "";

  let formatted: string;
  if (err instanceof Error) {
    const parts: string[] = [];
    const seen = new Set<unknown>();
    let current: unknown = err;

    while (current && !seen.has(current)) {
      seen.add(current);
      if (current instanceof Error) {
        const code = readErrorCode(current);
        const message = current.message || current.name || "Error";
        parts.push(code ? `${message} [code=${code}]` : message);
        current = current.cause;
        continue;
      }
      if (typeof current === "string") {
        parts.push(current);
      } else {
        try {
          parts.push(JSON.stringify(current));
        } catch {
          parts.push(String(current));
        }
      }
      break;
    }

    formatted = parts.join(" | ");
  } else {
    formatted = String(err);
  }

  return formatted.length > maxLen ? formatted.slice(0, maxLen) : formatted;
}
