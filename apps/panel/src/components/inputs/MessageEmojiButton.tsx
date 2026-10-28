import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { TkIconButton, TkPopover } from "../design-system/index.js";
import "./MessageEmojiButton.css";

const MessageEmojiPicker = lazy(() => import("./MessageEmojiPicker.js"));

/** Inserts Unicode text into the existing draft; never submits a message. */
export function MessageEmojiButton({
  textareaRef,
  onValueChange,
  disabled = false,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selectionRef = useRef({ start: 0, end: 0, value: "" });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const focusFrameRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (focusFrameRef.current !== null) cancelAnimationFrame(focusFrameRef.current);
    },
    [],
  );

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open || disabled) return;
    // Consume Escape before the surrounding conversation modal handles it.
    const closePicker = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", closePicker, true);
    return () => document.removeEventListener("keydown", closePicker, true);
  }, [open, disabled]);

  function changeOpen(nextOpen: boolean) {
    if (nextOpen && disabled) return;
    const input = textareaRef.current;
    if (nextOpen && input) {
      selectionRef.current = {
        start: input.selectionStart,
        end: input.selectionEnd,
        value: input.value,
      };
    }
    setOpen(nextOpen);
  }

  function insertEmoji(emoji: string) {
    const input = textareaRef.current;
    if (disabled || !input || input.disabled || !input.isConnected) return;
    const saved = selectionRef.current;
    const start = saved.value === input.value ? saved.start : input.selectionStart;
    const end = saved.value === input.value ? saved.end : input.selectionEnd;
    onValueChange(input.value.slice(0, start) + emoji + input.value.slice(end));
    setOpen(false);
    focusFrameRef.current = requestAnimationFrame(() => {
      focusFrameRef.current = null;
      if (textareaRef.current !== input || !input.isConnected || input.disabled) return;
      input.focus({ preventScroll: true });
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  return (
    <TkPopover
      label={t("chat.emoji")}
      placement="top-start"
      open={open && !disabled}
      onOpenChange={changeOpen}
      className="message-emoji-popover"
      trigger={(props) => (
        <TkIconButton
          {...props}
          ref={(node) => {
            props.ref(node);
            triggerRef.current = node;
          }}
          label={t("chat.emoji")}
          disabled={disabled}
          size="sm"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M8 14s1.5 3 4 3 4-3 4-3M8 9h.01M16 9h.01" />
          </svg>
        </TkIconButton>
      )}
    >
      <Suspense
        fallback={
          <div className="message-emoji-loading" role="status">
            {t("common.loading")}
          </div>
        }
      >
        <MessageEmojiPicker onSelect={insertEmoji} />
      </Suspense>
    </TkPopover>
  );
}
