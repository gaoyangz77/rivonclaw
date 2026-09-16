/**
 * Decides whether text pasted into the rich-text editor is Markdown source that
 * should be rendered, rather than prose that should stay literal.
 *
 * Only the plain-text flavour is inspected. Content copied from something that
 * is already rendered — a web page, Word, Google Docs — has no Markdown markers
 * in its plain text, so it keeps the editor's own rich paste. Raw Markdown
 * copied from a `.md` file, a code editor or a chat answer does carry them. The
 * HTML flavour is deliberately ignored: code editors attach syntax-highlighted
 * HTML whose import would reproduce the markers as literal text.
 */

const BLOCK_PATTERNS: readonly RegExp[] = [
  /^#{1,6}\s+\S/, // ATX heading
  /^[-*+]\s+\S/, // bullet list item
  /^\d{1,9}[.)]\s+\S/, // ordered list item
  /^>\s?\S/, // blockquote
  /^(```|~~~)/, // fenced code
  /^(-{3,}|\*{3,}|_{3,})$/, // thematic break
  /^\|.*\|$/, // table row
  /^::(media|video)\{/, // this editor's own media directives
];

const INLINE_PATTERNS: readonly RegExp[] = [
  /\*\*[^*\n]+\*\*/, // strong
  /__[^_\n]+__/, // strong, underscore form
  /!?\[[^\]\n]+\]\([^)\s]+\)/, // link or image
];

export function looksLikeMarkdown(text: string): boolean {
  if (!text.trim()) return false;
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  if (lines.some((line) => BLOCK_PATTERNS.some((pattern) => pattern.test(line)))) {
    return true;
  }
  return INLINE_PATTERNS.some((pattern) => pattern.test(text));
}
