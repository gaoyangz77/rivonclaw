import { types } from "mobx-state-tree";

const ConversationModel = types.model("ExpertConversation", {
  id: types.identifier,
  title: types.string,
  lastMessageAt: types.string,
});

const MessageModel = types.model("ExpertMessage", {
  id: types.identifier,
  role: types.enumeration(["USER", "ASSISTANT", "SYSTEM"]),
  content: types.string,
  createdAt: types.string,
  suggestedQuestions: types.optional(types.array(types.string), []),
});

const UsageModel = types.model("ExpertUsage", {
  mode: types.string,
  freeRemaining: types.maybeNull(types.number),
  freeLimit: types.maybeNull(types.number),
  weeklyTokenRemaining: types.maybeNull(types.number),
  fiveHourTokenRemaining: types.maybeNull(types.number),
  resetsAt: types.string,
});

export const ExpertStore = types
  .model("ExpertStore", {
    booting: true,
    authenticated: false,
    userEmail: "",
    hasProfile: false,
    conversations: types.array(ConversationModel),
    selectedConversationId: types.maybe(types.string),
    messages: types.array(MessageModel),
    usage: types.maybe(UsageModel),
    knowledgeVersion: types.maybe(types.string),
    activeRunId: types.maybe(types.string),
    streamingAnswer: "",
    pendingSuggestedQuestions: types.array(types.string),
    runningTool: types.maybe(types.string),
    error: types.maybe(types.string),
  })
  .views((self) => ({
    get selectedConversation() {
      return self.conversations.find((item) => item.id === self.selectedConversationId);
    },
  }))
  .actions((self) => ({
    finishBoot(authenticated: boolean, email = "") {
      self.booting = false;
      self.authenticated = authenticated;
      self.userEmail = email;
    },
    signIn(email: string) {
      self.authenticated = true;
      self.userEmail = email;
      self.error = undefined;
    },
    signOut() {
      self.authenticated = false;
      self.userEmail = "";
      self.hasProfile = false;
      self.conversations.clear();
      self.messages.clear();
      self.selectedConversationId = undefined;
      self.activeRunId = undefined;
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
    },
    applyBootstrap(data: {
      profile: unknown;
      conversations: Array<{ id: string; title: string; lastMessageAt: string }>;
      usage?: {
        mode: string;
        freeRemaining?: number | null;
        freeLimit?: number | null;
        weeklyTokenRemaining?: number | null;
        fiveHourTokenRemaining?: number | null;
        resetsAt: string;
      };
      knowledgeVersion?: string;
    }) {
      self.hasProfile = Boolean(data.profile);
      self.conversations.replace(data.conversations);
      if (!self.selectedConversationId && data.conversations[0]) {
        self.selectedConversationId = data.conversations[0].id;
      }
      self.usage = data.usage
        ? {
            mode: data.usage.mode,
            freeRemaining: data.usage.freeRemaining ?? null,
            freeLimit: data.usage.freeLimit ?? null,
            weeklyTokenRemaining: data.usage.weeklyTokenRemaining ?? null,
            fiveHourTokenRemaining: data.usage.fiveHourTokenRemaining ?? null,
            resetsAt: data.usage.resetsAt,
          }
        : undefined;
      self.knowledgeVersion = data.knowledgeVersion;
    },
    markProfileComplete() {
      self.hasProfile = true;
    },
    addConversation(conversation: { id: string; title: string; lastMessageAt: string }) {
      self.conversations.unshift(conversation);
      self.selectedConversationId = conversation.id;
      self.messages.clear();
    },
    selectConversation(id: string) {
      self.selectedConversationId = id;
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
      self.error = undefined;
    },
    replaceMessages(
      messages: Array<{
        id: string;
        role: "USER" | "ASSISTANT" | "SYSTEM";
        content: string;
        createdAt: string;
        suggestedQuestions?: string[];
      }>,
    ) {
      self.messages.replace(
        messages.map((message) => ({
          ...message,
          suggestedQuestions: message.suggestedQuestions ?? [],
        })),
      );
    },
    beginRun(runId: string, question: string) {
      self.messages.push({
        id: `local-${runId}`,
        role: "USER",
        content: question,
        createdAt: new Date().toISOString(),
      });
      self.activeRunId = runId;
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
      self.error = undefined;
    },
    appendDelta(text: string) {
      self.streamingAnswer += text;
    },
    setRunningTool(toolName?: string) {
      self.runningTool = toolName;
    },
    setSuggestedQuestions(questions: string[]) {
      self.pendingSuggestedQuestions.replace(questions);
    },
    finishRun() {
      self.activeRunId = undefined;
      self.runningTool = undefined;
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
    },
    failRun(message: string) {
      self.error = message;
      self.activeRunId = undefined;
      self.runningTool = undefined;
      self.pendingSuggestedQuestions.clear();
    },
    setError(message?: string) {
      self.error = message;
    },
  }));

export const expertStore = ExpertStore.create();
