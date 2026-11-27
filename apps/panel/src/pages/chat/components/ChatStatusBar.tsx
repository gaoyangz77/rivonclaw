import { useTranslation } from "react-i18next";
import { observer } from "mobx-react-lite";
import { Select } from "../../../components/inputs/Select.js";
import { RunProfileSelector } from "../../../components/inputs/RunProfileSelector.js";
import { formatTokenCount } from "../chat-utils.js";

export interface ChatStatusBarProps {
  connectionState: string;
  agentName: string | null;
  thinkingLevel: string;
  onThinkingLevelChange: (level: string) => void;
  totalTokens: number;
  contextWindow: number | null;
  selectedRunProfileId: string;
  onRunProfileChange: (id: string) => void;
  onReset: () => void;
}

export const ChatStatusBar = observer(function ChatStatusBar({
  connectionState,
  agentName,
  thinkingLevel,
  onThinkingLevelChange,
  totalTokens,
  contextWindow,
  selectedRunProfileId,
  onRunProfileChange,
  onReset,
}: ChatStatusBarProps) {
  const { t } = useTranslation();

  const contextUsageRatio =
    contextWindow && contextWindow > 0 && totalTokens > 0 ? totalTokens / contextWindow : 0;
  const contextUsageClass =
    contextUsageRatio >= 1
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
    <div className="chat-status" data-tutorial-id="chat-controls">
      <span className={`chat-status-dot chat-status-dot-${connectionState}`} />
      <span>{agentName ? `${agentName} · ${t(statusKey)}` : t(statusKey)}</span>
      {connectionState === "connected" && (
        <Select
          className="chat-thinking-select"
          size="compact"
          variant="ghost"
          ariaLabel={t("chat.thinkingNone")}
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
