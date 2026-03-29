import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type ToastType = "success" | "error";

interface ToastState {
  message: string;
  type: ToastType;
  key: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

function ToastItem({ toast, onDismiss }: { toast: ToastState; onDismiss: (key: number) => void }) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setExiting(true);
      exitTimerRef.current = setTimeout(() => {
        onDismiss(toast.key);
      }, 150);
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [toast.key, onDismiss]);

  const typeClass = toast.type === "error" ? "toast-error" : "toast-success";
  const exitClass = exiting ? " toast-exit" : "";

  return (
    <div className={`toast ${typeClass}${exitClass}`}>
      {toast.message}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const keyRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    keyRef.current += 1;
    setToasts((prev) => [...prev, { message, type, key: keyRef.current }]);
  }, []);

  const handleDismiss = useCallback((key: number) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 &&
        createPortal(
          <div className="toast-container">
            {toasts.map((toast) => (
              <ToastItem key={toast.key} toast={toast} onDismiss={handleDismiss} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
