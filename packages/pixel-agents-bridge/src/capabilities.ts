import type { PixelAgentsMessage } from "./protocol.js";

/**
 * Tool taxonomy the renderer needs in order to draw a tool call.
 *
 * Upstream does not hardcode a tool list: `webview-ui/src/office/toolUtils.ts`
 * keeps an empty taxonomy until a host sends this message, and every module
 * that has to classify a tool - character animation, sub-agent creation - reads
 * from it. Until it arrives, `isReadingToolName` answers false for everything,
 * which is why an office that never sends this message types at every desk.
 *
 * It is declared here rather than in `protocol.ts` because it is not an agent
 * state message: it carries no agent id, is not diffed against a snapshot, and
 * is sent once per renderer lifetime rather than per change.
 */
export type ProviderCapabilities = {
  type: "providerCapabilities";
  /**
   * Tool names that should play the reading animation instead of typing.
   *
   * Matched against `agentToolStart.toolName` - NOT against `status`. The
   * renderer stores `msg.toolName ?? extractToolName(status)` in
   * `Character.currentTool` (`webview-ui/src/hooks/useExtensionMessages.ts`)
   * and `getCharacterSprite` tests exactly that value, so these must be raw
   * tool identifiers, never display captions.
   */
  readingTools: string[];
  /**
   * Tool names that spawn a visible sub-agent character.
   *
   * Always empty here, deliberately. Naming a tool makes the renderer call
   * `os.addSubagent` on `agentToolStart` and seat an extra character next to
   * its parent. This bridge never emits `subagentToolStart`/`subagentToolDone`
   * /`subagentToolsClear`, so that character would have no activity of its own,
   * and - more importantly - it is a worker the admission controller never
   * authorised. Desk count is the concurrency limit; a ghost seated beside a
   * desk shows more work in flight than the runtime permits, which is the one
   * thing the whole scene projection exists to avoid.
   */
  subagentToolNames: string[];
};

/** Everything the translator may hand the frame, agent state and taxonomy. */
export type OutboundMessage = PixelAgentsMessage | ProviderCapabilities;
