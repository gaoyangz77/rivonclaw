// AUTO-GENERATED from vendor/openclaw — do not edit manually.
// Re-generate with: node scripts/generate-vendor-artifacts.mjs

// ---------------------------------------------------------------------------
// Inlined from vendor/openclaw/src/shared/text/code-regions.ts (private)
// ---------------------------------------------------------------------------

// Code region helpers find fenced and inline code spans in Markdown text.
interface CodeRegion {
  start: number;
  end: number;
}

/** Finds fenced and inline Markdown code regions so text sanitizers can avoid examples. */
function findCodeRegions(text: string): CodeRegion[] {
  const regions: CodeRegion[] = [];

  const fencedRe = /(^|\n)(```|~~~)[^\n]*\n[\s\S]*?(?:\n\2|$)/g;
  for (const match of text.matchAll(fencedRe)) {
    const start = (match.index ?? 0) + match[1].length;
    regions.push({ start, end: start + match[0].length - match[1].length });
  }

  const inlineRe = /`+[^`]+`+/g;
  for (const match of text.matchAll(inlineRe)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const insideFenced = regions.some((r) => start >= r.start && end <= r.end);
    if (!insideFenced) {
      regions.push({ start, end });
    }
  }

  regions.sort((a, b) => a.start - b.start);
  return regions;
}

/** Returns true when a character offset falls inside one of the discovered code regions. */
function isInsideCode(pos: number, regions: CodeRegion[]): boolean {
  return regions.some((r) => pos >= r.start && pos < r.end);
}

// ---------------------------------------------------------------------------
// Inlined from vendor/openclaw/src/shared/text/final-tags.ts (public exports)
// ---------------------------------------------------------------------------

// Final tag helpers detect final-answer tag regions in assistant text.
type FinalTagMatch = {
  index: number;
  text: string;
  isClose: boolean;
  isSelfClosing: boolean;
};

const FINAL_TAG_CANDIDATE_RE = /<[^<>]*>/g;

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function parseAttributeList(text: string): boolean {
  let index = 0;
  while (index < text.length) {
    while (index < text.length && isWhitespace(text[index] ?? "")) {
      index += 1;
    }
    if (index >= text.length) {
      return true;
    }

    const nameStart = index;
    while (index < text.length) {
      const char = text[index] ?? "";
      if (isWhitespace(char) || char === "=") {
        break;
      }
      if (char === "/" || char === '"' || char === "'" || char === "<" || char === ">") {
        return false;
      }
      index += 1;
    }
    if (index === nameStart) {
      return false;
    }

    while (index < text.length && isWhitespace(text[index] ?? "")) {
      index += 1;
    }
    if (text[index] !== "=") {
      continue;
    }
    index += 1;
    while (index < text.length && isWhitespace(text[index] ?? "")) {
      index += 1;
    }
    if (index >= text.length) {
      return false;
    }

    const quote = text[index];
    if (quote === '"' || quote === "'") {
      index += 1;
      const end = text.indexOf(quote, index);
      if (end === -1) {
        return false;
      }
      index = end + 1;
      continue;
    }

    const valueStart = index;
    while (index < text.length && !isWhitespace(text[index] ?? "")) {
      const char = text[index] ?? "";
      if (char === '"' || char === "'" || char === "<" || char === ">") {
        return false;
      }
      index += 1;
    }
    if (index === valueStart) {
      return false;
    }
  }
  return true;
}

/** Parses a candidate `<final>` tag while rejecting lookalike names and malformed attributes. */
function parseFinalTag(text: string): Omit<FinalTagMatch, "index" | "text"> | null {
  if (!text.startsWith("<") || !text.endsWith(">")) {
    return null;
  }

  let body = text.slice(1, -1).trimStart();
  let isClose = false;
  if (body.startsWith("/")) {
    isClose = true;
    body = body.slice(1).trimStart();
  }

  if (!body.toLowerCase().startsWith("final")) {
    return null;
  }
  const boundary = body[5] ?? "";
  if (boundary && !isWhitespace(boundary) && boundary !== "/") {
    return null;
  }

  let rest = body.slice(5);
  if (isClose) {
    return rest.trim().length === 0 ? { isClose: true, isSelfClosing: false } : null;
  }

  const trimmedRest = rest.trimEnd();
  const isSelfClosing = trimmedRest.endsWith("/");
  rest = isSelfClosing ? trimmedRest.slice(0, -1) : rest;
  if (!parseAttributeList(rest)) {
    return null;
  }
  return { isClose: false, isSelfClosing };
}

/** Finds valid `<final>` control tags so callers can strip only actual model markers. */
export function findFinalTagMatches(text: string): FinalTagMatch[] {
  const matches: FinalTagMatch[] = [];
  for (const match of text.matchAll(FINAL_TAG_CANDIDATE_RE)) {
    const tagText = match[0];
    const parsed = parseFinalTag(tagText);
    if (!parsed) {
      continue;
    }
    matches.push({
      index: match.index ?? 0,
      text: tagText,
      ...parsed,
    });
  }
  return matches;
}

/** Removes valid `<final>` tags while preserving their enclosed visible answer text. */
export function stripFinalTags(text: string): string {
  let output = "";
  let lastIndex = 0;
  for (const match of findFinalTagMatches(text)) {
    output += text.slice(lastIndex, match.index);
    lastIndex = match.index + match.text.length;
  }
  output += text.slice(lastIndex);
  return output;
}

// ---------------------------------------------------------------------------
// From vendor/openclaw/src/shared/text/reasoning-tags.ts (public exports)
// ---------------------------------------------------------------------------

// Reasoning tag helpers find and remove model reasoning tag blocks from text.
export type ReasoningTagMode = "strict" | "preserve";
export type ReasoningTagTrim = "none" | "start" | "both";

// Reasoning tags may carry a model-specific namespace prefix (e.g. Anthropic's
// `antml:`, MiniMax's `mm:`). Accept the known prefixes so namespaced variants
// like `<mm:think>` are stripped instead of leaking into visible output.
const QUICK_TAG_RE = /<\s*\/?\s*(?:(?:antml:|mm:)?(?:think(?:ing)?|thought)|antthinking|final)\b/i;
const THINKING_TAG_RE =
  /<\s*(\/?)\s*(?:(?:antml:|mm:)?(?:think(?:ing)?|thought)|antthinking)\b[^<>]*>/gi;

function applyTrim(value: string, mode: ReasoningTagTrim): string {
  if (mode === "none") {
    return value;
  }
  if (mode === "start") {
    return value.trimStart();
  }
  return value.trim();
}

/** Detects whether a stray reasoning close tag separates two visible text regions. */
export function hasOrphanReasoningCloseBoundary(params: {
  before: string;
  after: string;
}): boolean {
  return params.before.trim().length > 0 && params.after.trim().length > 0;
}

/** Strips model reasoning/final tags from visible text while preserving literal code examples. */
export function stripReasoningTagsFromText(
  text: string,
  options?: {
    mode?: ReasoningTagMode;
    trim?: ReasoningTagTrim;
  },
): string {
  if (!text) {
    return text;
  }
  if (!QUICK_TAG_RE.test(text)) {
    return text;
  }

  const mode = options?.mode ?? "strict";
  const trimMode = options?.trim ?? "both";

  let cleaned = text;
  const matches = findFinalTagMatches(cleaned);
  THINKING_TAG_RE.lastIndex = 0;
  const hasThinkingTag = THINKING_TAG_RE.test(cleaned);
  THINKING_TAG_RE.lastIndex = 0;
  if (matches.length === 0 && !hasThinkingTag) {
    return text;
  }
  if (matches.length > 0) {
    const finalMatches: Array<{ start: number; length: number; inCode: boolean }> = [];
    const preCodeRegions = findCodeRegions(cleaned);
    for (const match of matches) {
      const start = match.index;
      finalMatches.push({
        start,
        length: match.text.length,
        inCode: isInsideCode(start, preCodeRegions),
      });
    }

    for (let i = finalMatches.length - 1; i >= 0; i--) {
      const m = finalMatches[i];
      if (!m.inCode) {
        cleaned = cleaned.slice(0, m.start) + cleaned.slice(m.start + m.length);
      }
    }
  }

  const codeRegions = findCodeRegions(cleaned);

  THINKING_TAG_RE.lastIndex = 0;
  let result = "";
  let lastIndex = 0;
  let thinkingDepth = 0;
  let firstUnclosedContentIndex: number | undefined;

  for (const match of cleaned.matchAll(THINKING_TAG_RE)) {
    const idx = match.index ?? 0;
    const isClose = match[1] === "/";

    if (isInsideCode(idx, codeRegions)) {
      continue;
    }

    if (thinkingDepth === 0) {
      if (isClose) {
        const afterIndex = idx + match[0].length;
        const before = cleaned.slice(lastIndex, idx);
        const after = cleaned.slice(afterIndex);
        if (hasOrphanReasoningCloseBoundary({ before, after })) {
          // A lone close tag after visible preamble means the hidden opening tag was
          // probably truncated; drop the preamble so partial reasoning is not leaked.
          result = "";
        } else {
          result += before;
        }
        lastIndex = afterIndex;
        continue;
      }
      result += cleaned.slice(lastIndex, idx);
      thinkingDepth = 1;
      firstUnclosedContentIndex = idx + match[0].length;
    } else if (isClose) {
      thinkingDepth -= 1;
      if (thinkingDepth === 0) {
        firstUnclosedContentIndex = undefined;
      }
    } else {
      thinkingDepth += 1;
    }

    lastIndex = idx + match[0].length;
  }

  if (thinkingDepth === 0 || mode === "preserve") {
    result += cleaned.slice(lastIndex);
  }

  const trimmedResult = applyTrim(result, trimMode);
  if (
    mode === "strict" &&
    thinkingDepth > 0 &&
    !trimmedResult &&
    firstUnclosedContentIndex !== undefined &&
    cleaned.trim()
  ) {
    return applyTrim(cleaned.slice(firstUnclosedContentIndex), trimMode);
  }

  return trimmedResult;
}
