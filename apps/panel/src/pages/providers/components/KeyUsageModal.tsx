import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { Modal } from "../../../components/modals/Modal.js";
import { useEntityStore } from "../../../store/index.js";

export interface KeyUsageModalProps {
  keyId: string | null;
  onClose: () => void;
}

/**
 * Modal showing per-key subscription quota (Claude / Codex / Gemini).
 *
 * Reads `usage` reactively from the MST ProviderKey entry. The data is written
 * by Desktop's `LLMProviderManager.fetchKeyUsage` and flows here via the entity
 * SSE patch — this component does not `await` the fetch or manage its own state.
 *
 * Fetch cadence: fire once per open. Quota freshness matters more than network
 * economy, so there's no caching; reopening refetches.
 */
export const KeyUsageModal = observer(function KeyUsageModal({ keyId, onClose }: KeyUsageModalProps) {
  const { t } = useTranslation();
  const store = useEntityStore();
  const key = keyId ? store.providerKeys.find((k) => k.id === keyId) : null;

  useEffect(() => {
    if (!key) return;
    // Fire-and-forget: the result flows back via SSE and MobX re-renders us.
    key.fetchUsage().catch(() => {
      // Desktop-side errors (unsupported provider, missing key) return 4xx.
      // Network/HTTP errors from the provider are captured into usage.error on MST,
      // so there's nothing meaningful to surface here beyond logging.
    });
    // Intentionally only re-fire when the modal is re-opened with a different keyId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyId]);

  const isOpen = keyId !== null;
  const usage = key?.usage;
  const hasPriorData = !!usage && usage.updatedAt > 0;
  const isLoading = !!usage?.fetching && !hasPriorData;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("providers.usageModal.title", {
        label: key?.label ?? "",
        defaultValue: "Subscription Usage — {{label}}",
      })}
      maxWidth={480}
    >
      <div className="key-usage-body">
        {!key ? null : isLoading ? (
          <div className="key-usage-empty">{t("providers.usageModal.loading")}</div>
        ) : usage?.error ? (
          <div className="key-usage-error">{usage.error}</div>
        ) : !usage || usage.windows.length === 0 ? (
          <div className="key-usage-empty">{t("providers.usageModal.empty")}</div>
        ) : (
          <>
            {usage.plan && (
              <div className="key-usage-plan">{usage.plan}</div>
            )}
            <div className="key-usage-windows">
              {usage.windows.map((w, idx) => (
                <UsageWindowRow
                  key={`${w.label}-${idx}`}
                  label={w.label}
                  usedPercent={w.usedPercent}
                  resetAt={w.resetAt}
                  refreshesAtLabel={t("providers.usageModal.refreshesAt", {
                    time: w.resetAt ? formatResetTime(w.resetAt) : "",
                  })}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
});

function UsageWindowRow({
  label,
  usedPercent,
  resetAt,
  refreshesAtLabel,
}: {
  label: string;
  usedPercent: number;
  resetAt?: number;
  refreshesAtLabel: string;
}) {
  // The vendor fetchers already `clampPercent` to [0, 100]; guard locally too
  // so a malformed MST snapshot can't push the progress bar out of range.
  const pct = Math.max(0, Math.min(100, usedPercent));
  // "Low remaining" = danger; the vendor reports *used* percent, so the red
  // threshold fires when usedPercent crosses 80 (mirrors AccountProfileCard's
  // remainingPercent < 20 semantics, just inverted for the used axis).
  const isHigh = pct >= 80;
  return (
    <div className="key-usage-row">
      <div className="quota-header">
        <span className="key-usage-label">{label}</span>
        {resetAt ? (
          <span className="quota-refresh-time">{refreshesAtLabel}</span>
        ) : null}
      </div>
      <div className="quota-bar-wrap">
        <progress
          className={`quota-bar${isHigh ? " quota-bar-low" : ""}`}
          value={pct}
          max={100}
        />
        <span className="quota-bar-label">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

/**
 * Format a Unix-ms reset timestamp as a short locale-aware date/time string.
 * Falls back to ISO date if Intl formatting throws (shouldn't happen in
 * Electron/Chromium but cheap to guard).
 */
function formatResetTime(resetAtMs: number): string {
  try {
    return new Date(resetAtMs).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(resetAtMs).toISOString();
  }
}
