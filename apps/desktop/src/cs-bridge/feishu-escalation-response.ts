import { createLogger } from "@rivonclaw/logger";
import type { CsEscalationResponseHistoryRepository } from "@rivonclaw/storage";
import { rootStore } from "../app/store/desktop-store.js";
import { getAuthSession } from "../auth/session-ref.js";
import { patchFeishuCardMessage, sendFeishuTextMessage } from "../channels/feishu-open-api.js";
import {
  buildFeishuCsEscalationNoticeCard,
  buildFeishuCsEscalationResultCard,
  type CsEscalationNoticeState,
} from "./cs-escalation-card.js";
import { getCsEscalationCardMessages } from "./cs-escalation-card-i18n.js";
import {
  CsEscalationResponseProcessor,
  type CsEscalationResponseChannelAdapter,
  type CsEscalationResponseDetails,
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
  chatType?: "p2p" | "group";
  submittedAt: number;
}

/**
 * Feishu write-back transport used to render the escalation result.
 *
 * These calls go straight to the Feishu Open API from the Desktop main process rather
 * than through the gateway's `message.action` RPC: the gateway event loop routinely
 * stalls for tens of seconds under load, which left the result card unrendered for
 * nearly every callback.
 */
export interface FeishuEscalationMessenger {
  patchCard(params: {
    accountId: string;
    messageId: string;
    card: Record<string, unknown>;
  }): Promise<void>;
  sendText(params: { accountId: string; receiveId: string; text: string }): Promise<void>;
}

export const feishuOpenApiMessenger: FeishuEscalationMessenger = {
  patchCard: patchFeishuCardMessage,
  sendText: sendFeishuTextMessage,
};

export interface FeishuEscalationResponseProcessorDeps {
  locale: () => string | undefined;
  getAuth: typeof getAuthSession;
  messenger: FeishuEscalationMessenger;
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
    ...(payload.chatType ? { chatType: payload.chatType } : {}),
    submittedAt: payload.submittedAt,
  };
}

class FeishuEscalationResponseAdapter implements CsEscalationResponseChannelAdapter {
  readonly telemetrySource = "feishu_card";

  constructor(
    private readonly locale: () => string | undefined,
    private readonly messenger: FeishuEscalationMessenger,
  ) {}

  async updateMessage(
    submission: CsEscalationResponseSubmission,
    view: CsEscalationResponseView,
  ): Promise<void> {
    await this.messenger.patchCard({
      accountId: submission.accountId,
      messageId: submission.messageId,
      card: buildFeishuCsEscalationResultCard({
        ...view,
        locale: this.locale(),
      }),
    });
  }

  async acknowledgeSubmission(
    submission: CsEscalationResponseSubmission,
    details: CsEscalationResponseDetails,
  ): Promise<void> {
    await this.patchNotice(submission, details, "submitting");
  }

  async sendFailure(
    submission: CsEscalationResponseSubmission,
    details?: CsEscalationResponseDetails,
  ): Promise<void> {
    const text = getCsEscalationCardMessages(this.locale()).failed;
    // No details means the acknowledgement never ran, so the card was never frozen and
    // there is nothing to unfreeze — leave it untouched and just reply.
    if (!details) {
      await this.send(submission, text, "failure");
      return;
    }
    // Otherwise the card is frozen, so a definite failure has to unfreeze it —
    // else the employee is left with a dead button and no way to retry.
    await this.patchNoticeOrReply(submission, details, "failed", text, "failure");
  }

  async sendUncertain(
    submission: CsEscalationResponseSubmission,
    details: CsEscalationResponseDetails,
  ): Promise<void> {
    await this.patchNoticeOrReply(
      submission,
      details,
      "unconfirmed",
      getCsEscalationCardMessages(this.locale()).resultUnconfirmed,
      "uncertain",
    );
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

  private async patchNotice(
    submission: CsEscalationResponseSubmission,
    details: CsEscalationResponseDetails,
    state: CsEscalationNoticeState,
  ): Promise<void> {
    await this.messenger.patchCard({
      accountId: submission.accountId,
      messageId: submission.messageId,
      card: buildFeishuCsEscalationNoticeCard({
        ...details,
        locale: this.locale(),
        state,
      }),
    });
  }

  private async patchNoticeOrReply(
    submission: CsEscalationResponseSubmission,
    details: CsEscalationResponseDetails,
    state: CsEscalationNoticeState,
    text: string,
    kind: "failure" | "uncertain",
  ): Promise<void> {
    try {
      await this.patchNotice(submission, details, state);
      return;
    } catch (error) {
      log.warn(
        `Failed to patch Feishu CS ${kind} card escalation=${submission.escalationId} ` +
          `account=${submission.accountId} message=${submission.messageId}`,
        error,
      );
    }
    await this.send(submission, text, kind);
  }

  private async send(
    submission: CsEscalationResponseSubmission,
    text: string,
    kind: "failure" | "fallback" | "uncertain",
  ): Promise<void> {
    try {
      await this.messenger.sendText({
        accountId: submission.accountId,
        receiveId: submission.chatId,
        text,
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
      adapter: new FeishuEscalationResponseAdapter(deps.locale, deps.messenger),
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
    messenger: feishuOpenApiMessenger,
    history,
    resolveShopName: (shopId) => rootStore.findShopByObjectOrPlatformId(shopId, null)?.shopName,
  });
}
