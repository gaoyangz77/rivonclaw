import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../components/Toast.js";
import { fetchJson } from "../../../api/client.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";

export function useLogUpload() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    setUploading(true);
    try {
      await fetchJson(clientPath(API["logs.upload"]), { method: "POST" });
      showToast(t("settings.logUpload.success"), "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) {
        showToast(t("settings.logUpload.notFound"), "error");
      } else if (msg.includes("too large") || msg.includes("413")) {
        showToast(t("settings.logUpload.tooLarge"), "error");
      } else if (msg.includes("Rate limit")) {
        showToast(t("settings.logUpload.rateLimited"), "error");
      } else {
        showToast(t("settings.logUpload.failed") + msg, "error");
      }
    } finally {
      setUploading(false);
    }
  }

  return { uploading, handleUpload };
}
