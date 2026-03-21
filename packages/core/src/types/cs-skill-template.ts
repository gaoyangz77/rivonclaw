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

// ── Abstract tool binding (platform-agnostic → platform-specific) ──
export const csToolBindingSchema = z.object({
  abstractName: z.string(),   // e.g. "cs.get_conversations"
  platformTool: z.string(),   // e.g. "tiktok_get_conversations"
  description: z.string(),
  required: z.boolean().default(true),
});

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

// ── User customization ──
export const csToneSchema = z.enum(["FORMAL", "FRIENDLY", "CASUAL"]);

export const csCustomizationSchema = z.object({
  tone: csToneSchema.default("FRIENDLY"),
  businessPrompt: z.string().default(""),        // Store-specific instructions
  productKnowledge: z.string().default(""),       // Product FAQ / knowledge base text
  autoGreeting: z.string().optional(),            // Auto-greeting message
  maxResponseTimeSeconds: z.number().int().default(300),
  language: z.string().default("en"),
  forbiddenTopics: z.array(z.string()).default([]), // Topics agent should refuse
});

// ── Full skill template ──
export const csSkillTemplateSchema = z.object({
  templateId: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  supportedIntents: z.array(csIntentTypeSchema),
  toolBindings: z.array(csToolBindingSchema),
  escalationRules: z.array(csEscalationRuleSchema),
  customization: csCustomizationSchema,
});

// ── Tool binding preset (maps abstract names to a platform) ──
export const csToolBindingPresetSchema = z.object({
  platform: z.string(),        // e.g. "tiktok_shop"
  bindings: z.array(csToolBindingSchema),
});

// Export inferred types
export type CSIntentType = z.infer<typeof csIntentTypeSchema>;
export type CSToolBinding = z.infer<typeof csToolBindingSchema>;
export type CSEscalationRule = z.infer<typeof csEscalationRuleSchema>;
export type CSCustomization = z.infer<typeof csCustomizationSchema>;
export type CSSkillTemplate = z.infer<typeof csSkillTemplateSchema>;
export type CSToolBindingPreset = z.infer<typeof csToolBindingPresetSchema>;
