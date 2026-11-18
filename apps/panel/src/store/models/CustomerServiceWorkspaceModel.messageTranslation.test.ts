import { types } from "mobx-state-tree";
import { describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { CS_TRANSLATE_MESSAGES_MUTATION } from "../../api/shops-queries.js";
import {
  CustomerServiceWorkspaceModel,
  MESSAGE_TRANSLATION_FAILED,
} from "./CustomerServiceWorkspaceModel.js";

vi.mock("../../api/client.js", () => ({ fetchJson: vi.fn(), fetchVoid: vi.fn() }));

const Level = GQL.CustomerServiceMessageAutoTranslation;

function message(n: number, extra: Record<string, unknown> = {}) {
  return {
    messageId: `m${n}`,
    index: String(n),
    type: "TEXT",
    text: `text ${n}`,
    createTime: String(1000 + n),
    sender: { role: n % 2 ? "BUYER" : "CUSTOMER_SERVICE", nickname: "x" },
    ...extra,
  };
}

function reply(ids: string[]) {
  return {
    data: {
      translateCustomerServiceMessages: ids.map((messageId) => ({
        messageId,
        sameLanguage: false,
        translatedText: `tr ${messageId}`,
      })),
    },
  };
}

async function fixture(options: {
  level?: GQL.CustomerServiceMessageAutoTranslation;
  openEscalationCount?: number;
  messages: Record<string, unknown>[];
  mutate?: ReturnType<typeof vi.fn>;
}) {
  const mutate =
    options.mutate ??
    vi.fn(async ({ variables }) => reply(variables.input.messages.map((m: any) => m.messageId)));
  const page = { items: options.messages };
  const query = vi.fn(async () => ({
    data: { ecommerceGetConversationMessages: { items: page.items, nextPageToken: null } },
  }));
  const Root = types.model({
    shops: types.frozen<unknown[]>([]),
    workspace: CustomerServiceWorkspaceModel,
  });
  const root = Root.create(
    {
      shops: [
        {
          id: "shop",
          services: { customerService: { messageAutoTranslation: options.level ?? Level.Off } },
        },
      ],
      workspace: {
        conversationItems: [
          {
            shopId: "shop",
            conversationId: "chat",
            status: GQL.CustomerServiceConversationStatus.Pending,
            isOpen: true,
            aiEnabled: true,
            openEscalationCount: options.openEscalationCount ?? 0,
          },
          {
            shopId: "shop",
            conversationId: "other",
            status: GQL.CustomerServiceConversationStatus.Pending,
            isOpen: true,
            aiEnabled: true,
            openEscalationCount: 0,
          },
        ],
      },
    },
    { apolloClient: { mutate, query } },
  );
  root.workspace.selectConversation("shop", "chat");
  /** Loads `messages` the way the page does: through fetchConversationMessages. */
  const load = async (messages: Record<string, unknown>[]) => {
    page.items = messages;
    await root.workspace.fetchConversationMessages("en");
  };
  await load(options.messages);
  return { root, workspace: root.workspace, mutate, load };
}

describe("messageTranslationActive", () => {
  const cases: Array<[GQL.CustomerServiceMessageAutoTranslation, number, boolean]> = [
    [Level.Off, 0, false],
    [Level.Off, 2, false],
    [Level.Escalated, 0, false],
    [Level.Escalated, 1, true],
    [Level.All, 0, true],
    [Level.All, 3, true],
  ];
  it.each(cases)("shop %s with %i open escalations -> %s", async (level, count, expected) => {
    const { workspace } = await fixture({ level, openEscalationCount: count, messages: [] });
    expect(workspace.messageTranslationActive).toBe(expected);
  });

  it("lets the per-conversation choice override the shop setting in both directions", async () => {
    const { workspace: off } = await fixture({ level: Level.Off, messages: [] });
    off.toggleMessageTranslation();
    expect(off.messageTranslationActive).toBe(true);
    off.toggleMessageTranslation();
    expect(off.messageTranslationActive).toBe(false);

    const { workspace: all } = await fixture({ level: Level.All, messages: [] });
    all.toggleMessageTranslation();
    expect(all.messageTranslationActive).toBe(false);
    all.selectConversation("shop", "other");
    expect(all.messageTranslationActive).toBe(true);
    all.selectConversation("shop", "chat");
    expect(all.messageTranslationActive).toBe(false);
  });

  it("is inactive without a selected conversation", async () => {
    const { workspace } = await fixture({ level: Level.All, messages: [] });
    workspace.selectConversation(null);
    expect(workspace.messageTranslationActive).toBe(false);
  });
});

describe("translateLoadedMessages", () => {
  it("sends only translatable text messages, buyer and seller side, and ingests results", async () => {
    const { workspace, mutate } = await fixture({
      messages: [
        message(1),
        message(2),
        message(3, { type: "IMAGE", text: '{"url":"https://x"}' }),
        message(4, { type: "ORDER_CARD" }),
        message(5, { text: "   " }),
        message(6, { text: "x".repeat(4001) }),
        message(7, { messageId: "" }),
        message(8, { sender: { role: "SYSTEM" } }),
        message(9),
      ],
    });
    await workspace.translateLoadedMessages("zh");
    expect(mutate).toHaveBeenCalledTimes(1);
    const call = mutate.mock.calls[0][0];
    expect(call.mutation).toBe(CS_TRANSLATE_MESSAGES_MUTATION);
    expect(call.variables.input).toEqual({
      shopId: "shop",
      conversationId: "chat",
      targetLanguage: "ZH",
      messages: [
        { messageId: "m1", senderRole: "BUYER", text: "text 1" },
        { messageId: "m2", senderRole: "CUSTOMER_SERVICE", text: "text 2" },
        { messageId: "m9", senderRole: "BUYER", text: "text 9" },
      ],
      context: [],
    });
    expect(workspace.messageTranslationFor("m1", "zh")).toEqual({
      sameLanguage: false,
      translatedText: "tr m1",
    });
    expect(workspace.messageTranslationFor("m1", "en")).toBeUndefined();
    expect(workspace.messageTranslationLoading).toBe(false);
  });

  it("does not resend translated messages and sends the up-to-6 preceding ones as context", async () => {
    const all = Array.from({ length: 10 }, (_, i) => message(i + 1));
    const { workspace, mutate, load } = await fixture({ messages: all.slice(0, 3) });
    await workspace.translateLoadedMessages("en");
    expect(mutate.mock.calls[0][0].variables.input.messages.map((m: any) => m.messageId)).toEqual([
      "m1",
      "m2",
      "m3",
    ]);

    await load(all);
    await workspace.translateLoadedMessages("en");
    const input = mutate.mock.calls[1][0].variables.input;
    expect(input.messages.map((m: any) => m.messageId)).toEqual(
      ["m4", "m5", "m6", "m7", "m8", "m9", "m10"],
    );
    expect(input.context.map((m: any) => m.messageId)).toEqual(
      ["m1", "m2", "m3"],
    );

    await workspace.translateLoadedMessages("en");
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it("caps context at 6 messages", async () => {
    const all = Array.from({ length: 10 }, (_, i) => message(i + 1));
    const { workspace, mutate, load } = await fixture({ messages: all.slice(0, 9) });
    await workspace.translateLoadedMessages("en");
    await load(all);
    await workspace.translateLoadedMessages("en");
    const input = mutate.mock.calls[1][0].variables.input;
    expect(input.messages.map((m: any) => m.messageId)).toEqual(["m10"]);
    expect(input.context.map((m: any) => m.messageId)).toEqual(
      ["m4", "m5", "m6", "m7", "m8", "m9"],
    );
  });

  it("batches at 50 messages, sequentially, each batch with its own context", async () => {
    const all = Array.from({ length: 120 }, (_, i) => message(i + 1));
    let inFlight = 0;
    let maxInFlight = 0;
    const mutate = vi.fn(async ({ variables }) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return reply(variables.input.messages.map((m: any) => m.messageId));
    });
    const { workspace } = await fixture({ messages: all, mutate });
    await workspace.translateLoadedMessages("en");
    expect(mutate.mock.calls.map((c) => c[0].variables.input.messages.length)).toEqual([50, 50, 20]);
    expect(maxInFlight).toBe(1);
    expect(mutate.mock.calls[0][0].variables.input.context).toEqual([]);
    expect(mutate.mock.calls[1][0].variables.input.context.map((m: any) => m.messageId)).toEqual(
      ["m45", "m46", "m47", "m48", "m49", "m50"],
    );
    expect(workspace.messageTranslations.size).toBe(120);
  });

  it.each([
    ["CS_MESSAGE_TRANSLATION_SUBSCRIPTION_REQUIRED", "CS_MESSAGE_TRANSLATION_SUBSCRIPTION_REQUIRED"],
    ["CS_MESSAGE_TRANSLATION_QUOTA_EXHAUSTED", "CS_MESSAGE_TRANSLATION_QUOTA_EXHAUSTED"],
    [undefined, MESSAGE_TRANSLATION_FAILED],
  ])("stores the failure code %s and stops", async (code, expected) => {
    const all = Array.from({ length: 60 }, (_, i) => message(i + 1));
    const mutate = vi.fn().mockRejectedValue(
      Object.assign(new Error("boom"), {
        errors: code ? [{ extensions: { code } }] : [],
      }),
    );
    const { workspace } = await fixture({ messages: all, mutate });
    await workspace.translateLoadedMessages("en");
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(workspace.messageTranslationErrorCode).toBe(expected);
    expect(workspace.messageTranslationLoading).toBe(false);
    expect(workspace.messageTranslations.size).toBe(0);
  });

  it("clears the error when translation is toggled", async () => {
    const mutate = vi.fn().mockRejectedValue(new Error("boom"));
    const { workspace } = await fixture({ messages: [message(1)], mutate });
    await workspace.translateLoadedMessages("en");
    expect(workspace.messageTranslationErrorCode).toBe(MESSAGE_TRANSLATION_FAILED);
    workspace.toggleMessageTranslation();
    expect(workspace.messageTranslationErrorCode).toBeNull();
  });

  it("does not double-send messages whose request is in flight", async () => {
    let finish!: (value: unknown) => void;
    const mutate = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const { workspace } = await fixture({ messages: [message(1)], mutate });
    const first = workspace.translateLoadedMessages("en");
    expect(workspace.messageTranslationLoading).toBe(true);
    await workspace.translateLoadedMessages("en");
    expect(mutate).toHaveBeenCalledTimes(1);
    finish(reply(["m1"]));
    await first;
    expect(workspace.messageTranslationFor("m1", "en")?.translatedText).toBe("tr m1");
  });

  it("drops translations when the language changes", async () => {
    const { workspace, mutate } = await fixture({ messages: [message(1)] });
    await workspace.translateLoadedMessages("en");
    await workspace.translateLoadedMessages("de");
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate.mock.calls[1][0].variables.input.targetLanguage).toBe("DE");
    expect(workspace.messageTranslationFor("m1", "en")).toBeUndefined();
    expect(workspace.messageTranslationFor("m1", "de")?.translatedText).toBe("tr m1");
  });

  it("drops translations and ignores late results when the conversation changes", async () => {
    let finish!: (value: unknown) => void;
    const mutate = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const { workspace } = await fixture({ messages: [message(1)], mutate });
    const pending = workspace.translateLoadedMessages("en");
    workspace.selectConversation("shop", "other");
    expect(workspace.messageTranslationLoading).toBe(false);
    finish(reply(["m1"]));
    await pending;
    expect(workspace.messageTranslations.size).toBe(0);
    expect(workspace.messageTranslationLanguage).toBeNull();
  });

  it("reports an unsupported UI language as a failure without calling the backend", async () => {
    const { workspace, mutate } = await fixture({ messages: [message(1)] });
    await workspace.translateLoadedMessages("xx");
    expect(mutate).not.toHaveBeenCalled();
    expect(workspace.messageTranslationErrorCode).toBe(MESSAGE_TRANSLATION_FAILED);
  });
});
