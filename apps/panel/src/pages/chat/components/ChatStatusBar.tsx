import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { Select } from "../../../components/inputs/Select.js";
import { KeyModelSelector } from "../../../components/inputs/KeyModelSelector.js";
import { RunProfileSelector } from "../../../components/inputs/RunProfileSelector.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { formatTokenCount } from "../chat-utils.js";
import type { ActiveModelInfo } from "../hooks/useChatModelControls.js";

export interface ChatStatusBarProps {
  connectionState: string;
  agentName: string | null;
  activeModel: ActiveModelInfo | null;
  thinkingLevel: string;
  onThinkingLevelChange: (level: string) => void;
  totalTokens: number;
  contextWindow: number | null;
  selectedRunProfileId: string;
  onRunProfileChange: (id: string) => void;
  onKeyModelChange: (provider: string, model: string) => void;
  onReset: () => void;
}

export const ChatStatusBar = observer(function ChatStatusBar({
  connectionState,
  agentName,
  activeModel,
  thinkingLevel,
  onThinkingLevelChange,
  totalTokens,
  contextWindow,
  selectedRunProfileId,
  onRunProfileChange,
  onKeyModelChange,
  onReset,
}: ChatStatusBarProps) {
  const { t } = useTranslation();
  const entityStore = useEntityStore();

  const contextUsageRatio = contextWindow && contextWindow > 0 && totalTokens > 0
    ? totalTokens / contextWindow
    : 0;
  const contextUsageClass = contextUsageRatio >= 1
    ? "chat-context-critical"
    : contextUsageRatio >= 0.8
      ? "chat-context-warning"
      : "";
  const statusKey =
    connectionState === "connected"
      ? "chat.connected"
      : connectionState === "connecting"
        ? "chat.connecting"
        : "chat.disconnected";

  return (
    <div className="chat-status">
      <span className={`chat-status-dot chat-status-dot-${connectionState}`} />
      <span>{agentName ? `${agentName} · ${t(statusKey)}` : t(statusKey)}</span>
      {connectionState === "connected" && activeModel && (
        <KeyModelSelector
          keys={entityStore.providerKeys.map((k) => ({
            id: k.id,
            provider: k.provider,
            label: k.label,
            model: k.model,
            isDefault: k.isDefault,
          }))}
          catalog={entityStore.llmManager.catalog}
          selectedProvider={activeModel.provider}
          selectedModel={activeModel.model}
          onChange={onKeyModelChange}
          allowDefault
          isFollowingDefault={!activeModel.isOverridden}
        />
      )}
      {connectionState === "connected" && (
        <Select
          className="chat-thinking-select"
          value={thinkingLevel}
          onChange={onThinkingLevelChange}
          options={[
            { value: "", label: t("chat.thinkingNone") },
            { value: "low", label: t("chat.thinkingLow") },
            { value: "medium", label: t("chat.thinkingMedium") },
            { value: "high", label: t("chat.thinkingHigh") },
          ]}
        />
      )}
      {totalTokens > 0 && contextWindow && contextWindow > 0 && (
        <span
          className={`chat-context-usage ${contextUsageClass}`}
          title={t("chat.contextUsageTooltip")}
        >
          {t("chat.contextUsage", {
            current: formatTokenCount(totalTokens),
            max: formatTokenCount(contextWindow),
          })}
        </span>
      )}
      <span className="chat-status-spacer" />
      <RunProfileSelector
        value={selectedRunProfileId}
        onChange={onRunProfileChange}
        className="chat-profile-select"
      />
      <button
        className="btn btn-sm btn-secondary"
        onClick={onReset}
        disabled={connectionState !== "connected"}
        title={t("chat.resetTooltip")}
      >
        {t("chat.resetCommand")}
      </button>
    </div>
  );
});
