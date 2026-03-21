/**
 * Browser Mode Context — prependSystemContext injection
 *
 * Uses the `before_prompt_build` hook to prepend browser mode instructions
 * to the system prompt so the LLM only sees guidance relevant to the currently
 * configured browser mode (standalone or CDP). This overrides the hardcoded
 * browser tool description from the vendor system prompt.
 */

type PromptBuildEvent = {
  prompt: string;
  messages?: unknown[];
};

type PromptBuildResult = {
  prependSystemContext?: string;
};

const CDP_CONTEXT = [
  "Browser is configured in CDP mode — connected to the user's existing Chrome via remote debugging.",
  "The default browser (omit profile) connects to the user's real Chrome at the CDP endpoint.",
  'Do NOT use `profile="chrome-relay"` — Chrome extension relay is NOT available in this mode.',
  "Ignore all instructions about Chrome extension relay, Browser Relay toolbar, or \"attach tab\".",
  "The browser is the user's actual Chrome with their real tabs, extensions, and login sessions.",
].join("\n");

const STANDALONE_CONTEXT = [
  "Browser is configured in standalone mode — using an isolated managed browser.",
  "The default browser (omit profile) is managed by the runtime.",
  'Do NOT use `profile="chrome-relay"` — Chrome extension relay is NOT available in this mode.',
  "Ignore all instructions about Chrome extension relay, Browser Relay toolbar, or \"attach tab\".",
].join("\n");

export function createBrowserModeContext(
  browserMode: "standalone" | "cdp",
): (event: PromptBuildEvent) => PromptBuildResult {
  const context = browserMode === "cdp" ? CDP_CONTEXT : STANDALONE_CONTEXT;

  return function handlePromptBuild(_event: PromptBuildEvent): PromptBuildResult {
    return { prependSystemContext: context };
  };
}
