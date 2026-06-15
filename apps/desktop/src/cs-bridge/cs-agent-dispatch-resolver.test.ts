import { describe, expect, it } from "vitest";
import { buildCsAgentDispatchSystemPrompt } from "./cs-agent-dispatch-resolver.js";

describe("buildCsAgentDispatchSystemPrompt", () => {
  it("allows expiring escalation dispatches to dismiss resolved escalations before ending the session", () => {
    const prompt = buildCsAgentDispatchSystemPrompt("SESSION_EXPIRING_ESCALATION_FOLLOW_UP");

    expect(prompt).toContain("call cs_dismiss_conversation_escalations");
    expect(prompt).toContain("After dismissing open escalations, call ecom_cs_end_session");
    expect(prompt).toContain("Never call ecom_cs_end_session while an escalation is still open");
  });

  it("requires resolved close-out dispatches to use reviewRequestMessage for recent orders", () => {
    const prompt = buildCsAgentDispatchSystemPrompt("SESSION_EXPIRING_CUSTOMER_FOLLOW_UP");

    expect(prompt).toContain("reviewRequestMessage");
    expect(prompt).toContain("the backend sends that message before ending the session");
    expect(prompt).toContain("If the buyer still needs help");
  });
});
