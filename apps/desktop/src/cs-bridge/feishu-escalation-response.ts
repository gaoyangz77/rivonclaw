import { createLogger } from "@rivonclaw/logger";
import type { CsEscalationResponseHistoryRepository } from "@rivonclaw/storage";
import { rootStore } from "../app/store/desktop-store.js";
import { getAuthSession } from "../auth/session-ref.js";
import { openClawConnector } from "../openclaw/index.js";
import { buildFeishuCsEscalationResultCard } from "./cs-escalation-card.js";
import { getCsEscalationCardMessages } from "./cs-escalation-card-i18n.js";
import {
  CsEscalationResponseProcessor,
  type CsEscalationResponseChannelAdapter,
  type CsEscalationResponseSubmission,
  type CsEscalationResponseView,
} from "./cs-escalation-response.js";

const log = createLogger("feishu-cs-response");

export interface CsEscalationResponseGatewayPayload {
  schemaVersion: 1;
  callbackId: string;
  accountId: string;
  operatorOpenId: string;
  chatId: string;
  messageId: string;
  escalationId: string;
  decision: string;
  resolved: boolean;
  submittedAt: number;
}

export interface FeishuEscalationResponseProcessorDeps {
  locale: () => string | undefined;
  getAuth: typeof getAuthSession;
  gatewayRequest: typeof openClawConnector.request;
  history: CsEscalationResponseHistoryRepository;
  resolveShopName: (shopId: string) => string | undefined;
  mutationTimeoutMs?: number;
}

function toSubmission(payload: CsEscalationResponseGatewayPayload): CsEscalationResponseSubmission {
  return {
    schemaVersion: payload.schemaVersion,
    callbackId: payload.callbackId,
    channelId: "feishu",
    accountId: payload.accountId,
    operatorId: payload.operatorOpenId,
    chatId: payload.chatId,
    messageId: payload.messageId,
    escalationId: payload.escalationId,
    decision: payload.decision,
    resolved: payload.resolved,
    submittedAt: payload.submittedAt,
  };
}

class FeishuEscalationResponseAdapter implements CsEscalationResponseChannelAdapter {
  readonly telemetrySource = "feishu_card";

  constructor(
    private readonly locale: () => string | undefined,
    private readonly gatewayRequest: typeof openClawConnector.request,
  ) {}

  async updateMessage(
    submission: CsEscalationResponseSubmission,
    view: CsEscalationResponseView,
  ): Promise<void> {
    await this.gatewayRequest("message.action", {
      channel: "feishu",
      action: "edit",
      accountId: submission.accountId,
      idempotencyKey: `feishu-cs-result:${submission.callbackId}`,
      params: {
        messageId: submission.messageId,
        card: buildFeishuCsEscalationResultCard({
          ...view,
          locale: this.locale(),
        }),
      },
    });
  }

  async sendFailure(submission: CsEscalationResponseSubmission): Promise<void> {
    await this.send(submission, getCsEscalationCardMessages(this.locale()).failed, "failure");
  }

  async sendSuccessFallback(
    submission: CsEscalationResponseSubmission,
    options: { alreadyProcessed: boolean },
  ): Promise<void> {
    const t = getCsEscalationCardMessages(this.locale());
    await this.send(
      submission,
      options.alreadyProcessed ? t.alreadyProcessed : t.succeeded,
      "fallback",
    );
  }

  private async send(
    submission: CsEscalationResponseSubmission,
    text: string,
    kind: "failure" | "fallback",
  ): Promise<void> {
    try {
      await this.gatewayRequest("message.action", {
        channel: "feishu",
        action: "send",
        accountId: submission.accountId,
        idempotencyKey: `feishu-cs-${kind}:${submission.callbackId}`,
        params: { to: submission.chatId, text },
      });
    } catch (error) {
      log.warn(
        `Failed to send Feishu CS ${kind} escalation=${submission.escalationId} ` +
          `account=${submission.accountId} chat=${submission.chatId} message=${submission.messageId}`,
        error,
      );
    }
  }
}

/** Feishu transport wrapper around the channel-neutral escalation response processor. */
export class FeishuEscalationResponseProcessor {
  private readonly processor: CsEscalationResponseProcessor;

  constructor(deps: FeishuEscalationResponseProcessorDeps) {
    this.processor = new CsEscalationResponseProcessor({
      getAuth: deps.getAuth,
      adapter: new FeishuEscalationResponseAdapter(deps.locale, deps.gatewayRequest),
      history: deps.history,
      resolveShopName: deps.resolveShopName,
      mutationTimeoutMs: deps.mutationTimeoutMs,
    });
  }

  handle(payload: CsEscalationResponseGatewayPayload): Promise<void> {
    return this.processor.handle(toSubmission(payload));
  }
}

export function createFeishuEscalationResponseProcessor(
  locale: () => string | undefined,
  history: CsEscalationResponseHistoryRepository,
) {
  return new FeishuEscalationResponseProcessor({
    locale,
    getAuth: getAuthSession,
    gatewayRequest: openClawConnector.request.bind(openClawConnector),
    history,
    resolveShopName: (shopId) => rootStore.findShopByObjectOrPlatformId(shopId, null)?.shopName,
  });
}
