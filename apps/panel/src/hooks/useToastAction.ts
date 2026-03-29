import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../components/Toast.js";

/**
 * Returns a helper that wraps an async mutation action with toast notifications.
 *
 * On success it shows a translated success message.
 * On failure it shows the error via `common.operationFailed`.
 *
 * Usage:
 * ```ts
 * const toastAction = useToastAction();
 * await toastAction(() => saveSomething(), "common.saved");
 * ```
 */
export function useToastAction() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  return useCallback(
    async (action: () => Promise<void>, successKey: string) => {
      try {
        await action();
        showToast(t(successKey), "success");
      } catch (e) {
        showToast(
          t("common.operationFailed", {
            message: e instanceof Error ? e.message : String(e),
          }),
          "error",
        );
      }
    },
    [t, showToast],
  );
}
