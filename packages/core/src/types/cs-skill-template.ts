import { z } from "zod/v4";

// ── Intent types the CS skill can recognize ──
export const csIntentTypeSchema = z.enum([
  "GREETING",           // Customer greeting/hello
  "ORDER_STATUS",       // "Where is my order?"
  "REFUND_REQUEST",     // "I want a refund"
  "PRODUCT_INQUIRY",    // "Tell me about this product"
  "SHIPPING_INQUIRY",   // "When will it arrive?"
  "COMPLAINT",          // Negative experience
  "GENERAL_QUESTION",   // Catch-all
  "ESCALATION",         // Explicit request for human agent
]);

// ── Escalation rules ──
export const csEscalationTriggerSchema = z.enum([
  "KEYWORD",            // Specific keywords detected
  "SENTIMENT",          // Negative sentiment threshold
  "INTENT",             // Specific intent detected (e.g., ESCALATION)
  "REPEATED_FAILURE",   // Agent failed to resolve N times
  "TIMEOUT",            // No resolution within time limit
  "EXPLICIT_REQUEST",   // Customer explicitly asks for human
]);

export const csEscalationActionSchema = z.enum([
  "TRANSFER_HUMAN",  // Transfer to human agent
  "NOTIFY_OWNER",    // Send notification to store owner
  "AUTO_CLOSE",      // Close conversation with message
]);

export const csEscalationRuleSchema = z.object({
  trigger: csEscalationTriggerSchema,
  condition: z.string(),   // trigger-specific condition (keyword pattern, threshold, etc.)
  action: csEscalationActionSchema,
  message: z.string().optional(), // Message to send when escalating
});

// Export inferred types
export type CSIntentType = z.infer<typeof csIntentTypeSchema>;
export type CSEscalationRule = z.infer<typeof csEscalationRuleSchema>;
