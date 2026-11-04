import { useLayoutEffect, useRef, useState } from "react";
import { useEntityStore } from "../store/EntityStoreProvider.js";
import { translationIdentity } from "../lib/message-translation.js";
import type { MessageTranslationResult } from "@rivonclaw/core/api-contract";

export interface TranslationSendOutcome {
  complete: boolean;
  textSent?: boolean;
  freezeText?: boolean;
  error?: string;
}
interface Preview {
  draftFingerprint?: string;
  original: string;
  text: string;
  language: string;
  source: "messages" | "site";
  /** Opened because a one-click send needed review, not because the agent asked for a preview. */
  fromAutoSend?: boolean;
  loading: boolean;
  sending: boolean;
  textSent: boolean;
  freezeText?: boolean;
  error: string | null;
}
/** UI state contains plain unsaved drafts only; language decisions live in MST. */
export function useMessageTranslation(options: {
  contextKey?: string;
  draftFingerprint?: () => string;
  routeKey: string;
  text: string;
  samples: string[];
  signature: string;
  fallbackLanguage: string;
  disabled: boolean;
  /** `language` is the BCP-47 target language the text was translated into. */
  send: (
    text: string,
    textAlreadySent: boolean,
    language: string,
  ) => Promise<TranslationSendOutcome>;
  /** Receives translation failures of one-click (`autoSend`) requests, which have no modal to show them. */
  onAutoSendError?: (message: string) => void;
}) {
  const store = useEntityStore();
  const identity = translationIdentity(store.currentUser);
  const key = JSON.stringify([identity, options.routeKey, options.contextKey]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const request = useRef(0);
  const activeKey = useRef(key);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const sending = useRef(false);
  const [autoPending, setAutoPending] = useState(false);
  // Async continuations must call the latest send/fingerprint, not the render that started them.
  const latest = useRef(options);
  latest.current = options;
  useLayoutEffect(() => {
    activeKey.current = key;
    ++request.current;
    busy.current = false;
    sending.current = false;
    setAutoPending(false);
    setPreview(null);
    return () => {
      activeKey.current = "";
      ++request.current;
      controller.current?.abort();
    };
  }, [key]);

  function close() {
    if (sending.current) return;
    ++request.current;
    controller.current?.abort();
    busy.current = false;
    setPreview(null);
  }
  /**
   * `autoSend` sends the translation without a modal when the target language
   * came from the recipient's own messages. A site-default guess still opens the
   * preview so the agent can check the language first.
   */
  async function generate({ autoSend = false }: { autoSend?: boolean } = {}) {
    if (busy.current || options.disabled || !identity || !options.text.trim()) return;
    busy.current = true;
    const revision = ++request.current;
    const original = options.text;
    const draftFingerprint = options.draftFingerprint?.();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    if (autoSend) setAutoPending(true);
    else
      setPreview({
        original,
        draftFingerprint,
        text: "",
        language: "",
        source: "site",
        loading: true,
        sending: false,
        textSent: false,
        error: null,
      });
    try {
      const result: MessageTranslationResult = await store.messageTranslation.translate({
        identity,
        key: options.routeKey,
        text: original,
        samples: options.samples,
        signature: options.signature,
        fallbackLanguage: options.fallbackLanguage,
        signal: abort.signal,
      });
      if (activeKey.current !== key || request.current !== revision) return;
      const reviewed = {
        original,
        draftFingerprint,
        ...result,
        fromAutoSend: autoSend || undefined,
        loading: false,
        sending: false,
        textSent: false,
        error: null,
      };
      if (autoSend && result.source === "messages") {
        await sendWithoutReview(reviewed);
        return;
      }
      setAutoPending(false);
      setPreview(reviewed);
    } catch (error) {
      if (activeKey.current !== key || request.current !== revision) return;
      if (autoSend) {
        setAutoPending(false);
        latest.current.onAutoSendError?.(error instanceof Error ? error.message : String(error));
        return;
      }
      setPreview(
        (current) =>
          current && {
            ...current,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          },
      );
    } finally {
      if (activeKey.current === key && request.current === revision) busy.current = false;
    }
  }
  async function sendWithoutReview(reviewed: Preview) {
    const revision = request.current;
    if (reviewed.draftFingerprint !== latest.current.draftFingerprint?.()) {
      setAutoPending(false);
      return;
    }
    sending.current = true;
    let outcome: TranslationSendOutcome;
    try {
      outcome = await latest.current.send(reviewed.text, false, reviewed.language);
    } catch (error) {
      outcome = { complete: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      if (activeKey.current === key && request.current === revision) sending.current = false;
    }
    if (activeKey.current !== key || request.current !== revision) return;
    setAutoPending(false);
    // Anything already delivered or any failure moves to the review modal, whose
    // retry keeps the textSent/freezeText guarantees.
    if (!outcome.complete && (outcome.textSent || outcome.freezeText || outcome.error))
      setPreview({
        ...reviewed,
        textSent: Boolean(outcome.textSent),
        freezeText: outcome.freezeText,
        error: outcome.error ?? null,
      });
  }
  async function confirm() {
    if (
      busy.current ||
      !preview?.text.trim() ||
      preview.loading ||
      activeKey.current !== key ||
      options.disabled
    )
      return;
    if (
      !preview.textSent &&
      !preview.freezeText &&
      preview.draftFingerprint !== options.draftFingerprint?.()
    ) {
      close();
      return;
    }
    busy.current = sending.current = true;
    const revision = request.current;
    setPreview((current) => current && { ...current, sending: true, error: null });
    try {
      const outcome = await options.send(preview.text, preview.textSent, preview.language);
      if (activeKey.current !== key || request.current !== revision) return;
      if (outcome.complete) setPreview(null);
      else
        setPreview(
          (current) =>
            current && {
              ...current,
              sending: false,
              textSent: current.textSent || Boolean(outcome.textSent),
              freezeText: current.freezeText || outcome.freezeText,
              error: outcome.error ?? null,
            },
        );
    } catch (error) {
      if (activeKey.current === key && request.current === revision)
        setPreview(
          (current) =>
            current && {
              ...current,
              sending: false,
              error: error instanceof Error ? error.message : String(error),
            },
        );
    } finally {
      if (activeKey.current === key && request.current === revision)
        busy.current = sending.current = false;
    }
  }
  return {
    preview,
    locked: preview !== null || autoPending,
    /** A one-click request is translating or sending; no modal is shown. */
    pending: autoPending,
    generate,
    close,
    confirm,
    edit: (text: string) =>
      setPreview((current) =>
        current && !current.sending && !current.textSent && !current.freezeText
          ? { ...current, text }
          : current,
      ),
  };
}
