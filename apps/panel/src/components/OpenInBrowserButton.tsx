import { useTranslation } from "react-i18next";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import { fetchJson } from "../api/client.js";
import { ExternalLinkIcon } from "./icons.js";

export function OpenInBrowserButton() {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className="sidebar-action-trigger sidebar-action-tooltip"
      data-tooltip={t("common.openInBrowser")}
      aria-label={t("common.openInBrowser")}
      onClick={() => {
        void fetchJson<{ ok: boolean }>(clientPath(API["app.openInBrowser"]), { method: "POST" });
      }}
    >
      <ExternalLinkIcon size={18} />
    </button>
  );
}
