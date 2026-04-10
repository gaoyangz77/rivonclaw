import { useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

export function InfoTip({ tooltipKey }: { tooltipKey: string }) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    // Position below the trigger if space allows, otherwise above
    const top = spaceBelow > 120 ? rect.bottom + 6 : rect.top - 6;
    setBubble({ top, left: rect.left + rect.width / 2 });
  }, []);

  const hide = useCallback(() => setBubble(null), []);

  return (
    <>
      <span
        ref={triggerRef}
        className="crons-tip-trigger"
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        ?
      </span>
      {bubble && createPortal(
        <div
          className="crons-tip-bubble"
          style={{
            top: bubble.top,
            left: bubble.left,
          }}
        >
          {t(`crons.${tooltipKey}`)}
        </div>,
        document.body,
      )}
    </>
  );
}
