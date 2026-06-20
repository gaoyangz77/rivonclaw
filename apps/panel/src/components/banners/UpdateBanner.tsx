import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatError } from "@rivonclaw/core";
import {
  cancelUpdateDownload,
  fetchUpdateDownloadStatus,
  fetchUpdateInfo,
  startUpdateDownload,
  triggerUpdateInstall,
  type UpdateDownloadStatus,
  type UpdateInfo,
} from "../../api/index.js";
import { panelEventBus } from "../../lib/event-bus.js";

interface UpdateBannerProps {
  onCurrentVersionChange: (version: string) => void;
}

export function UpdateBanner({ onCurrentVersionChange }: UpdateBannerProps) {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<UpdateDownloadStatus>({
    status: "idle",
  });

  // Check for updates after startup, when the window becomes visible, and when
  // Desktop pushes an update-available event through the panel event bus.
  useEffect(() => {
    function check() {
      fetchUpdateInfo()
        .then((info) => {
          if (info.currentVersion) onCurrentVersionChange(info.currentVersion);
          if (info.updateAvailable) setUpdateInfo(info);
        })
        .catch(() => {});
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") check();
    }

    const firstTimer = window.setTimeout(check, 5_000);
    const retryTimer = window.setTimeout(check, 20_000);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const unsubscribeUpdate = panelEventBus.subscribe("update-available", (raw) => {
      const data = raw as UpdateInfo & { currentVersion?: string };
      if (data.currentVersion) onCurrentVersionChange(data.currentVersion);
      setUpdateInfo(data.updateAvailable ? data : null);
    });

    return () => {
      window.clearTimeout(firstTimer);
      window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unsubscribeUpdate();
    };
  }, [onCurrentVersionChange]);

  // Poll download status: fast when actively downloading, slower while the
  // update banner is visible but idle.
  useEffect(() => {
    if (!updateInfo) return;

    function poll() {
      fetchUpdateDownloadStatus()
        .then((status) => {
          setDownloadStatus(status);
        })
        .catch(() => {});
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") poll();
    }

    const active =
      downloadStatus.status === "downloading" ||
      downloadStatus.status === "verifying" ||
      downloadStatus.status === "installing";
    const interval = active ? 500 : 3000;
    const id = window.setInterval(poll, interval);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [downloadStatus.status, updateInfo]);

  function handleDownload() {
    setDownloadStatus({ status: "downloading", percent: 0 });
    startUpdateDownload().catch((err) => {
      setDownloadStatus({
        status: "error",
        message: formatError(err),
      });
    });
  }

  function handleCancel() {
    cancelUpdateDownload().catch(() => {});
    setDownloadStatus({ status: "idle" });
  }

  function handleInstall() {
    setDownloadStatus({ status: "installing" });
    triggerUpdateInstall().catch((err) => {
      setDownloadStatus({
        status: "error",
        message: formatError(err),
      });
    });
  }

  if (!updateInfo) return null;

  const ds = downloadStatus;
  return (
    <div className="update-banner">
      <span className="update-banner-content">
        {ds.status === "idle" && (
          <>
            {t("update.bannerText", { version: updateInfo.latestVersion })}
            <button
              className="update-banner-action"
              onClick={handleDownload}
            >
              {t("update.download")}
            </button>
          </>
        )}
        {ds.status === "downloading" && (
          <>
            {t("update.downloading", { percent: ds.percent ?? 0 })}
            <span className="update-progress-bar">
              <span
                className="update-progress-fill"
                style={{ width: `${ds.percent ?? 0}%` }}
              />
            </span>
            <button className="update-banner-action" onClick={handleCancel}>
              {t("update.cancel")}
            </button>
          </>
        )}
        {ds.status === "verifying" && t("update.verifying")}
        {ds.status === "ready" && (
          <>
            {t("update.ready")}{" "}
            <button
              className="update-banner-action update-banner-action-primary"
              onClick={handleInstall}
            >
              {t("update.installRestart")}
            </button>
          </>
        )}
        {ds.status === "installing" && t("update.installing")}
        {ds.status === "error" && (
          <>
            {t("update.error", { message: ds.message ?? "" })}{" "}
            <button
              className="update-banner-action"
              onClick={handleDownload}
            >
              {t("update.retry")}
            </button>
          </>
        )}
      </span>
    </div>
  );
}
