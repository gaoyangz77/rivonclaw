import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { pollFeishuSetup, startFeishuSetup } from "../../api/channels.js";
import { Modal } from "./Modal.js";

type Phase = "starting" | "scanning" | "refreshing" | "error";
type SetupToken = { aborted: boolean; controller: AbortController };

const SETUP_TIMEOUT_MS = 15 * 60_000;

function isZh(language: string): boolean {
  return language.toLowerCase().startsWith("zh");
}

function copy(language: string) {
  const zh = isZh(language);
  return {
    title: zh ? "连接飞书机器人" : "Connect Feishu/Lark Bot",
    eyebrow: zh ? "官方扫码创建" : "Official QR setup",
    heading: zh ? "用飞书客户端扫码，一键创建机器人" : "Scan in Feishu/Lark to create the bot",
    body: zh
      ? "RivonClaw 已内置飞书官方 OpenClaw 插件和安装环境。扫码完成后，我们会自动保存机器人凭证、启用官方插件，并刷新通道状态。"
      : "RivonClaw includes the official Feishu/Lark OpenClaw plugin and setup runtime. After scanning, it saves the bot credentials, enables the plugin, and refreshes channel status.",
    starting: zh ? "正在生成飞书二维码..." : "Generating Feishu/Lark QR code...",
    refreshing: zh ? "正在刷新二维码..." : "Refreshing QR code...",
    waiting: zh ? "等待扫码确认" : "Waiting for scan",
    refreshHint: zh
      ? "二维码会在过期前保持有效。请在飞书客户端内完成授权。"
      : "The QR code remains valid until the setup session expires. Finish authorization in the Feishu/Lark app.",
    retry: zh ? "重试" : "Retry",
    cancel: zh ? "取消" : "Cancel",
    advanced: zh ? "使用已有 App ID / Secret" : "Use existing App ID / Secret",
    expired: zh ? "二维码已过期，请重试。" : "The QR code expired. Please try again.",
    denied: zh ? "授权已取消。" : "Authorization was cancelled.",
    failed: zh ? "飞书连接失败，请重试。" : "Feishu/Lark setup failed. Please try again.",
  };
}

export function FeishuSetupModal({
  isOpen,
  onClose,
  onSuccess,
  onManualSetup,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onManualSetup: () => void;
}) {
  const { i18n } = useTranslation();
  const text = copy(i18n.language);
  const [phase, setPhase] = useState<Phase>("starting");
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeTokenRef = useRef<SetupToken | null>(null);
  const completedRef = useRef(false);
  const callbacksRef = useRef({ onClose, onSuccess, onManualSetup });
  const textRef = useRef(text);

  useEffect(() => {
    callbacksRef.current = { onClose, onSuccess, onManualSetup };
  }, [onClose, onSuccess, onManualSetup]);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const stopActive = useCallback(() => {
    const token = activeTokenRef.current;
    if (token && !token.aborted) {
      token.aborted = true;
      token.controller.abort();
    }
    activeTokenRef.current = null;
  }, []);

  const begin = useCallback(async () => {
    if (completedRef.current) return;

    stopActive();
    completedRef.current = false;
    const token: SetupToken = { aborted: false, controller: new AbortController() };
    activeTokenRef.current = token;
    const signal = token.controller.signal;

    setPhase("starting");
    setQrImageUrl(null);
    setErrorMessage(null);

    try {
      const deadline = Date.now() + SETUP_TIMEOUT_MS;
      let currentVerificationUrl: string | null = null;

      while (!token.aborted && Date.now() < deadline) {
        const start = await startFeishuSetup(signal);
        if (token.aborted) return;

        if (start.verificationUrl !== currentVerificationUrl) {
          currentVerificationUrl = start.verificationUrl;
          const qrData = await QRCode.toDataURL(currentVerificationUrl, {
            margin: 1,
            width: 250,
            color: { dark: "#000000FF", light: "#FFFFFFFF" },
          });
          if (token.aborted) return;
          setQrImageUrl(qrData);
        }
        setErrorMessage(null);
        setPhase("scanning");

        let delayMs = Math.max(2000, start.intervalMs || 5000);
        while (!token.aborted && Date.now() < start.expiresAt) {
          await new Promise((resolve) => window.setTimeout(resolve, delayMs));
          if (token.aborted) return;

          const result = await pollFeishuSetup(start.sessionKey, signal);
          if (token.aborted) return;

          if (result.status === "pending") {
            delayMs = Math.max(2000, result.intervalMs || delayMs);
            continue;
          }

          if (result.status === "connected") {
            completedRef.current = true;
            token.aborted = true;
            activeTokenRef.current = null;
            callbacksRef.current.onClose();
            void callbacksRef.current.onSuccess();
            return;
          }

          if (result.status === "expired") break;

          const fallback = result.status === "denied"
            ? textRef.current.denied
            : textRef.current.failed;
          setErrorMessage(result.message || fallback);
          setPhase("error");
          return;
        }

        if (!token.aborted && Date.now() < deadline) {
          setPhase("refreshing");
        }
      }

      if (!token.aborted && !completedRef.current) {
        setErrorMessage(textRef.current.expired);
        setPhase("error");
      }
    } catch (err: any) {
      if (token.aborted || err?.name === "AbortError") return;
      setErrorMessage(err?.message || textRef.current.failed);
      setPhase("error");
    } finally {
      if (activeTokenRef.current === token) activeTokenRef.current = null;
    }
  }, [stopActive]);

  useEffect(() => {
    if (!isOpen) return;
    completedRef.current = false;
    void begin();
    return stopActive;
  }, [begin, isOpen, stopActive]);

  function handleClose() {
    stopActive();
    onClose();
  }

  function handleManualSetup() {
    stopActive();
    callbacksRef.current.onManualSetup();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={text.title} maxWidth={460}>
      <div className="feishu-setup-modal">
        <div className="feishu-setup-intro">
          <span>{text.eyebrow}</span>
          <h3>{text.heading}</h3>
          <p>{text.body}</p>
        </div>

        {errorMessage && <div className="modal-error-box">{errorMessage}</div>}

        {(phase === "starting" || phase === "refreshing") && !qrImageUrl && (
          <div className="centered-muted">{phase === "refreshing" ? text.refreshing : text.starting}</div>
        )}

        {(phase === "scanning" || phase === "refreshing") && qrImageUrl && (
          <div className="qr-login-scan-view">
            <div className="mobile-qr-container feishu-setup-qr">
              <img src={qrImageUrl} alt={text.title} width={250} height={250} />
            </div>
            <div className="feishu-setup-status">
              <span className="badge badge-warning">
                {phase === "refreshing" ? text.refreshing : text.waiting}
              </span>
            </div>
            <p className="qr-login-countdown">{text.refreshHint}</p>
          </div>
        )}

        {phase === "error" && (
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={handleClose}>
              {text.cancel}
            </button>
            <button className="btn btn-primary" onClick={() => void begin()}>
              {text.retry}
            </button>
          </div>
        )}

        <div className="feishu-setup-advanced">
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleManualSetup}>
            {text.advanced}
          </button>
        </div>
      </div>
    </Modal>
  );
}
