import { describe, expect, it } from "vitest";
import { buildCsAgentDispatchSystemPrompt } from "./cs-agent-dispatch-resolver.js";

describe("buildCsAgentDispatchSystemPrompt", () => {
  it("requires pending buyer-message dispatches to send a buyer-facing reply", () => {
    const prompt = buildCsAgentDispatchSystemPrompt("PENDING_BUYER_MESSAGE");

    expect(prompt).toContain("MUST produce a buyer-facing reply");
    expect(prompt).toContain("instead of finishing silently");
    expect(prompt).toContain("unless you intentionally end the session");
  });

  it("allows expiring escalation dispatches to dismiss resolved escalations before ending the session", () => {
    const prompt = buildCsAgentDispatchSystemPrompt("SESSION_EXPIRING_ESCALATION_FOLLOW_UP");

    expect(prompt).toContain("call cs_dismiss_conversation_escalations");
    expect(prompt).toContain("After dismissing open escalations, call ecom_cs_end_session");
    expect(prompt).toContain("Use the current tool specs as the source of truth");
  });

  it("keeps resolved close-out dispatch prompts thin and delegates policy to operator instruction", () => {
    const prompt = buildCsAgentDispatchSystemPrompt("SESSION_EXPIRING_CUSTOMER_FOLLOW_UP");

    expect(prompt).toContain("approaching platform timeout");
    expect(prompt).toContain("backend-directed close-out dispatch");
    expect(prompt).toContain("Use the operator instruction as the task authority");
    expect(prompt).toContain("Follow the operator instruction");
    expect(prompt).toContain("Use the current tool specs as the source of truth");
    expect(prompt).toContain("Use the provided dispatch context and local session context");
    expect(prompt).not.toContain("Your task is to call ecom_cs_end_session");
    expect(prompt).not.toContain("Default to ecom_cs_end_session");
  });

  it("delegates bad-review workflow to backend without requiring a buyer message", () => {
    const prompt = buildCsAgentDispatchSystemPrompt("BAD_REVIEW_REACHOUT");

    expect(prompt).toContain("bad-review reachout");
    expect(prompt).toContain("Do not assume a buyer message triggered this run");
    expect(prompt).toContain(
      "Use the operator instruction as the task authority and review context",
    );
    expect(prompt).toContain("backend-provided workflow at the current conversation stage");
    expect(prompt).toContain("do not restart an already handled case");
    expect(prompt).toContain("An explicitly backend-authorized new round is not a duplicate send");
    expect(prompt).toContain("absence of a new buyer message alone do not suppress a due reminder");
    expect(prompt).toContain("operator instruction together with a bad-review round ID");
    expect(prompt).toContain("Without that round authorization, return NO_REPLY");
    expect(prompt).toContain("A retry with the same round ID is the same logical contact");
    expect(prompt).toContain("Do not resend an already delivered round");
    expect(prompt).toContain(
      "Keep the same round ID for backend-authorized retries of unsent attempts",
    );
    expect(prompt).toContain("Ordinary customer-service dispatches do not receive this exception");
    expect(prompt).not.toContain("or send a duplicate reachout");
    expect(prompt).not.toContain("Send one concise buyer-facing message");
    expect(prompt).not.toContain("Do not offer coupons");
  });

  it.each([
    "PENDING_BUYER_MESSAGE",
    "MANUAL_START",
    "SESSION_EXPIRING_ESCALATION_FOLLOW_UP",
    "SESSION_EXPIRING_CUSTOMER_FOLLOW_UP",
  ] as const)("does not grant the review-reminder exception to %s", (reason) => {
    const prompt = buildCsAgentDispatchSystemPrompt(reason);
    expect(prompt).not.toContain(
      "An explicitly backend-authorized new round is not a duplicate send",
    );
    expect(prompt).not.toContain("due reminder authorized by the backend");
  });
});
