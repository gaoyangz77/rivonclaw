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
  editedAt: types.maybe(types.string),
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

export interface ExpertUsageSnapshot {
  mode: string;
  freeRemaining?: number | null;
  freeLimit?: number | null;
  weeklyTokenRemaining?: number | null;
  fiveHourTokenRemaining?: number | null;
  resetsAt: string;
}

export const ExpertStore = types
  .model("ExpertStore", {
    booting: true,
    authenticated: false,
    userEmail: "",
    hasProfile: false,
    conversations: types.array(ConversationModel),
    selectedConversationId: types.maybe(types.string),
    isNewConversationDraft: false,
    messages: types.array(MessageModel),
    usage: types.maybe(UsageModel),
    knowledgeVersion: types.maybe(types.string),
    activeRunId: types.maybe(types.string),
    runPhase: types.optional(
      types.enumeration(["IDLE", "STARTING", "WAITING", "STREAMING", "CANCELLING"]),
      "IDLE",
    ),
    pendingQuestion: "",
    streamingAnswer: "",
    pendingSuggestedQuestions: types.array(types.string),
    runningTool: types.maybe(types.string),
    error: types.maybe(types.string),
    notice: types.maybe(types.string),
  })
  .views((self) => ({
    get selectedConversation() {
      return self.conversations.find((item) => item.id === self.selectedConversationId);
    },
    get isBusy() {
      return self.runPhase !== "IDLE";
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
      self.isNewConversationDraft = false;
      self.activeRunId = undefined;
      self.runPhase = "IDLE";
      self.pendingQuestion = "";
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
      self.runningTool = undefined;
      self.error = undefined;
      self.notice = undefined;
    },
    applyBootstrap(data: {
      profile: unknown;
      conversations: Array<{ id: string; title: string; lastMessageAt: string }>;
      usage?: ExpertUsageSnapshot;
      knowledgeVersion?: string;
    }) {
      self.hasProfile = Boolean(data.profile);
      self.conversations.replace(data.conversations);
      if (!self.isNewConversationDraft && !self.selectedConversationId && data.conversations[0]) {
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
    applyUsage(usage: ExpertUsageSnapshot) {
      self.usage = {
        mode: usage.mode,
        freeRemaining: usage.freeRemaining ?? null,
        freeLimit: usage.freeLimit ?? null,
        weeklyTokenRemaining: usage.weeklyTokenRemaining ?? null,
        fiveHourTokenRemaining: usage.fiveHourTokenRemaining ?? null,
        resetsAt: usage.resetsAt,
      };
    },
    optimisticallyConsumeFreeQuestion() {
      if (
        self.usage?.mode !== "FREE_DAILY" ||
        self.usage.freeRemaining === null ||
        self.usage.freeRemaining <= 0
      ) {
        return false;
      }
      self.usage.freeRemaining -= 1;
      return true;
    },
    restoreOptimisticFreeQuestion() {
      if (
        self.usage?.mode !== "FREE_DAILY" ||
        self.usage.freeRemaining === null
      ) {
        return;
      }
      const limit = self.usage.freeLimit ?? Number.POSITIVE_INFINITY;
      self.usage.freeRemaining = Math.min(limit, self.usage.freeRemaining + 1);
    },
    markProfileComplete() {
      self.hasProfile = true;
    },
    addConversation(conversation: { id: string; title: string; lastMessageAt: string }) {
      self.conversations.unshift(conversation);
      self.selectedConversationId = conversation.id;
      self.isNewConversationDraft = false;
      self.messages.clear();
    },
    startNewConversation() {
      if (self.runPhase !== "IDLE" || self.isNewConversationDraft) return;
      self.selectedConversationId = undefined;
      self.isNewConversationDraft = true;
      self.messages.clear();
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
      self.error = undefined;
      self.notice = undefined;
    },
    selectConversation(id: string) {
      if (self.runPhase !== "IDLE" || self.selectedConversationId === id) return;
      self.selectedConversationId = id;
      self.isNewConversationDraft = false;
      self.messages.clear();
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
      self.error = undefined;
      self.notice = undefined;
    },
    renameConversation(id: string, title: string) {
      const conversation = self.conversations.find((item) => item.id === id);
      if (conversation) conversation.title = title;
    },
    removeConversation(id: string) {
      const index = self.conversations.findIndex((item) => item.id === id);
      if (index >= 0) self.conversations.splice(index, 1);
      if (self.selectedConversationId === id) {
        self.selectedConversationId = undefined;
        self.isNewConversationDraft = true;
        self.messages.clear();
      }
    },
    replaceMessages(
      messages: Array<{
        id: string;
        role: "USER" | "ASSISTANT" | "SYSTEM";
        content: string;
        createdAt: string;
        editedAt?: string | null;
        suggestedQuestions?: string[];
      }>,
    ) {
      self.messages.replace(
        messages.map((message) => ({
          ...message,
          editedAt: message.editedAt ?? undefined,
          suggestedQuestions: message.suggestedQuestions ?? [],
        })),
      );
    },
    updateMessageContent(id: string, content: string, editedAt?: string) {
      const message = self.messages.find((item) => item.id === id);
      if (!message) return;
      message.content = content;
      message.editedAt = editedAt;
    },
    prepareRun(question: string) {
      self.pendingQuestion = question;
      self.runPhase = "STARTING";
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
      self.runningTool = undefined;
      self.error = undefined;
      self.notice = undefined;
    },
    prepareRerun(messageId: string, question: string) {
      const messageIndex = self.messages.findIndex((message) => message.id === messageId);
      if (messageIndex < 0 || self.messages[messageIndex]?.role !== "USER") {
        throw new Error("Editable user message not found");
      }
      self.messages.splice(messageIndex, self.messages.length - messageIndex);
      self.pendingQuestion = question;
      self.runPhase = "STARTING";
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
      self.runningTool = undefined;
      self.error = undefined;
      self.notice = undefined;
    },
    beginRun(runId: string) {
      self.messages.push({
        id: `local-${runId}`,
        role: "USER",
        content: self.pendingQuestion,
        createdAt: new Date().toISOString(),
      });
      self.pendingQuestion = "";
      self.activeRunId = runId;
      self.runPhase = "WAITING";
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
      self.error = undefined;
    },
    appendDelta(text: string) {
      self.streamingAnswer += text;
      self.runPhase = "STREAMING";
    },
    setRunningTool(toolName?: string) {
      self.runningTool = toolName;
    },
    setSuggestedQuestions(questions: string[]) {
      self.pendingSuggestedQuestions.replace(questions);
    },
    finishRun() {
      self.activeRunId = undefined;
      self.runPhase = "IDLE";
      self.pendingQuestion = "";
      self.runningTool = undefined;
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
    },
    failRun(message: string) {
      self.error = message;
      self.notice = undefined;
      self.activeRunId = undefined;
      self.runPhase = "IDLE";
      self.pendingQuestion = "";
      self.runningTool = undefined;
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
    },
    cancelRun(message: string) {
      self.notice = message;
      self.error = undefined;
      self.activeRunId = undefined;
      self.runPhase = "IDLE";
      self.pendingQuestion = "";
      self.runningTool = undefined;
      self.streamingAnswer = "";
      self.pendingSuggestedQuestions.clear();
    },
    markCancelling() {
      if (self.activeRunId) self.runPhase = "CANCELLING";
    },
    restoreWaitingAfterCancelFailure(message: string) {
      self.runPhase = self.streamingAnswer ? "STREAMING" : "WAITING";
      self.error = message;
    },
    setError(message?: string) {
      self.error = message;
      if (message) self.notice = undefined;
    },
  }));

export const expertStore = ExpertStore.create();
