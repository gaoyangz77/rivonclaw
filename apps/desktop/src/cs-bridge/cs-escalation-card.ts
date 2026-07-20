import { getCsEscalationCardMessages } from "./cs-escalation-card-i18n.js";
import type { CsEscalationFeedback } from "./cs-escalation-response.js";

const MAX_DYNAMIC_TEXT = 2_000;

export interface CsEscalationCardInput {
  escalationId: string;
  shop: string;
  conversationId: string;
  buyer: string;
  orderId?: string | null;
  reason: string;
  context?: string | null;
  locale?: string | null;
}

function safeCardMarkdown(value: string, limit = MAX_DYNAMIC_TEXT): string {
  return value
    .trim()
    .slice(0, limit)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function plainText(content: string): { tag: "plain_text"; content: string } {
  return { tag: "plain_text", content };
}

function buildEscalationDetails(input: CsEscalationCardInput): string {
  const t = getCsEscalationCardMessages(input.locale);
  return [
    `**${t.escalationId}:** ${safeCardMarkdown(input.escalationId, 128)}`,
    `**${t.shop}:** ${safeCardMarkdown(input.shop)}`,
    `**${t.conversation}:** ${safeCardMarkdown(input.conversationId, 256)}`,
    `**${t.buyer}:** ${safeCardMarkdown(input.buyer)}`,
    ...(input.orderId ? [`**${t.order}:** ${safeCardMarkdown(input.orderId, 256)}`] : []),
    `**${t.reason}:** ${safeCardMarkdown(input.reason)}`,
    ...(input.context ? [`**${t.context}:** ${safeCardMarkdown(input.context)}`] : []),
  ].join("\n");
}

function buildResponseForm(input: CsEscalationCardInput): Record<string, unknown> {
  const t = getCsEscalationCardMessages(input.locale);
  return {
    tag: "form",
    name: "cs_escalation_response",
    elements: [
      {
        tag: "input",
        name: "decision",
        label: plainText(t.decisionLabel),
        placeholder: plainText(t.decisionPlaceholder),
        input_type: "multiline_text",
        rows: 4,
        auto_resize: true,
        max_rows: 8,
        max_length: 1_000,
        required: true,
      },
      {
        tag: "select_static",
        name: "resolution",
        // Feishu Schema 2.0 does not accept `label` on select_static.
        // Keep the visible label as a separate form element, matching
        // the official Lark plugin's form-card structure.
        placeholder: plainText(t.resolutionLabel),
        required: true,
        initial_option: "resolved",
        options: [
          { text: plainText(t.unresolved), value: "unresolved" },
          { text: plainText(t.resolved), value: "resolved" },
        ],
      },
      {
        tag: "button",
        // Feishu Schema 2 form_submit callbacks can omit button.value.
        // Keep a routable, self-contained fallback in the button name.
        name: `rivonclaw.cs:respond:${encodeURIComponent(input.escalationId)}`,
        type: "primary",
        text: plainText(t.submit),
        form_action_type: "submit",
        value: {
          action: "rivonclaw.cs:respond",
          escalationId: input.escalationId,
          processingText: t.submitting,
          unauthorizedText: t.unauthorized,
          unavailableText: t.failed,
          failureText: t.failed,
        },
      },
    ],
  };
}

function formatFeedbackTime(timestamp: number, locale?: string | null): string {
  try {
    return new Intl.DateTimeFormat(locale || "en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toISOString();
  }
}

function buildFeedbackHistory(
  input: CsEscalationCardInput & {
    feedback: CsEscalationFeedback[];
    feedbackTotal: number;
  },
): string {
  const t = getCsEscalationCardMessages(input.locale);
  const omitted = Math.max(0, input.feedbackTotal - input.feedback.length);
  const entries = input.feedback.flatMap((item, index) => [
    `**#${omitted + index + 1} · ${formatFeedbackTime(item.submittedAt, input.locale)} · ${item.resolved ? t.resolved : t.unresolved}**`,
    safeCardMarkdown(item.decision, 1_000),
  ]);
  return [
    `**${t.feedbackHistory}**`,
    ...(omitted > 0 ? [t.olderFeedbackOmitted.replace("{count}", String(omitted))] : []),
    ...entries,
  ].join("\n");
}

function buildFinalResult(input: CsEscalationCardInput, feedback: CsEscalationFeedback): string {
  const t = getCsEscalationCardMessages(input.locale);
  return [
    `**${t.finalResult}**`,
    `**${formatFeedbackTime(feedback.submittedAt, input.locale)} · ${t.resolved}**`,
    safeCardMarkdown(feedback.decision, 1_000),
  ].join("\n");
}

export function buildFeishuCsEscalationCard(input: CsEscalationCardInput): Record<string, unknown> {
  const t = getCsEscalationCardMessages(input.locale);
  const details = buildEscalationDetails(input);

  return {
    schema: "2.0",
    config: { update_multi: true },
    header: {
      title: plainText(t.title),
      template: "orange",
    },
    body: {
      elements: [{ tag: "markdown", content: details }, buildResponseForm(input)],
    },
  };
}

export function buildFeishuCsEscalationResultCard(
  input: CsEscalationCardInput & {
    resolved: boolean;
    alreadyProcessed?: boolean;
    feedback: CsEscalationFeedback[];
    feedbackTotal: number;
  },
): Record<string, unknown> {
  const t = getCsEscalationCardMessages(input.locale);
  const finalFeedback = input.feedback.findLast((item) => item.resolved);
  const intermediateFeedback = input.feedback.filter((item) => !item.resolved);
  const intermediateTotal = Math.max(
    intermediateFeedback.length,
    input.feedbackTotal - (finalFeedback ? 1 : 0),
  );
  const content = input.resolved
    ? input.alreadyProcessed
      ? t.alreadyProcessed
      : t.succeeded
    : t.stillOpen;
  const resultSections = [
    ...(intermediateFeedback.length > 0
      ? [
          buildFeedbackHistory({
            ...input,
            feedback: intermediateFeedback,
            feedbackTotal: intermediateTotal,
          }),
        ]
      : []),
    ...(input.resolved && finalFeedback ? [buildFinalResult(input, finalFeedback)] : []),
    content,
  ];
  const result = resultSections.join("\n\n");
  return {
    schema: "2.0",
    config: { update_multi: true },
    header: { title: plainText(t.title), template: input.resolved ? "green" : "orange" },
    body: {
      elements: [
        { tag: "markdown", content: buildEscalationDetails(input) },
        { tag: "hr" },
        { tag: "markdown", content: result },
        ...(input.resolved ? [] : [buildResponseForm(input)]),
      ],
    },
  };
}
