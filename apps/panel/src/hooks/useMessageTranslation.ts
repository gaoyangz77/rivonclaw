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
  send: (text: string, textAlreadySent: boolean) => Promise<TranslationSendOutcome>;
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
  useLayoutEffect(() => {
    activeKey.current = key;
    ++request.current;
    busy.current = false;
    sending.current = false;
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
  async function generate() {
    if (busy.current || options.disabled || !identity || !options.text.trim()) return;
    busy.current = true;
    const revision = ++request.current;
    const original = options.text;
    const draftFingerprint = options.draftFingerprint?.();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
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
      setPreview({
        original,
        draftFingerprint,
        ...result,
        loading: false,
        sending: false,
        textSent: false,
        error: null,
      });
    } catch (error) {
      if (activeKey.current !== key || request.current !== revision) return;
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
      const outcome = await options.send(preview.text, preview.textSent);
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
    locked: preview !== null,
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
