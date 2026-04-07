// apps/panel/src/components/CreditsAuthModal.tsx
import { useState } from "react";
import { Modal } from "./modals/Modal.js";
import { useCreditsAuth } from "../hooks/useCreditsAuth.js";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreditsAuthModal({ isOpen, onClose, onSuccess }: Props) {
  const { login, register } = useCreditsAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchTab(t: "login" | "register") {
    setTab(t);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (tab === "register" && password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    setSubmitting(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="账号" maxWidth={400}>
      <div className="auth-modal-form">
        <div className="auth-tab-pill" role="tablist">
          <button
            className={`auth-tab-pill-btn${tab === "login" ? " auth-tab-pill-btn--active" : ""}`}
            onClick={() => switchTab("login")}
            role="tab"
            type="button"
          >登录</button>
          <button
            className={`auth-tab-pill-btn${tab === "register" ? " auth-tab-pill-btn--active" : ""}`}
            onClick={() => switchTab("register")}
            role="tab"
            type="button"
          >注册</button>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-label-block">
            邮箱
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
              autoComplete="email"
            />
          </label>
          <label className="form-label-block">
            密码{tab === "register" && <span className="auth-hint">（至少 8 位）</span>}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="auth-input"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary auth-submit-btn"
            disabled={submitting}
          >
            {submitting ? "请稍候…" : tab === "login" ? "登录" : "注册"}
          </button>
        </form>
      </div>
    </Modal>
  );
}
