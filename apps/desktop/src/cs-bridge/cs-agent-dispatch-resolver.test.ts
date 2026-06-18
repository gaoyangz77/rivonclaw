import { describe, expect, it } from "vitest";
import { buildCsAgentDispatchSystemPrompt } from "./cs-agent-dispatch-resolver.js";

describe("buildCsAgentDispatchSystemPrompt", () => {
  it("allows expiring escalation dispatches to dismiss resolved escalations before ending the session", () => {
    const prompt = buildCsAgentDispatchSystemPrompt("SESSION_EXPIRING_ESCALATION_FOLLOW_UP");

    expect(prompt).toContain("call cs_dismiss_conversation_escalations");
    expect(prompt).toContain("After dismissing open escalations, call ecom_cs_end_session");
    expect(prompt).toContain("Use the current tool specs as the source of truth");
  });

  it("keeps resolved close-out dispatch prompts thin and delegates policy to operator instruction", () => {
    const prompt = buildCsAgentDispatchSystemPrompt("SESSION_EXPIRING_CUSTOMER_FOLLOW_UP");

    expect(prompt).toContain("approaching platform timeout");
    expect(prompt).toContain("Follow the operator instruction");
    expect(prompt).toContain("Use the current tool specs as the source of truth");
    expect(prompt).toContain("Inspect the latest customer-service context");
    expect(prompt).not.toContain("Default to ecom_cs_end_session");
    expect(prompt).not.toContain("reviewRequestMessage");
  });
});
