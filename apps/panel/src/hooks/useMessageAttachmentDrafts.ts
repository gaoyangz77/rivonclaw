import { useLayoutEffect, useRef, useState, type ClipboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  clipboardImageFiles,
  MESSAGE_ATTACHMENT_LIMIT,
  MESSAGE_IMAGE_MAX_BYTES,
  MESSAGE_IMAGE_TYPES,
} from "../lib/message-attachments.js";

export interface MessageAttachmentDraft<T = undefined> {
  id: string;
  file: File;
  previewUrl?: string;
  status: "uploading" | "ready" | "failed";
  value?: T;
  error?: string;
}

/** Unsaved files only. Scope changes discard files and abort/ignore late uploads. */
export function useMessageAttachmentDrafts<T = undefined>({
  scopeKey,
  disabled = false,
  allowFiles = false,
  stage,
  onError,
}: {
  scopeKey: string;
  disabled?: boolean;
  allowFiles?: boolean;
  stage?: (file: File, signal: AbortSignal) => Promise<T>;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<MessageAttachmentDraft<T>[]>([]);
  const itemsRef = useRef(items);
  const activeScopeRef = useRef(scopeKey);
  const controllers = useRef(new Map<string, AbortController>());

  function replace(next: MessageAttachmentDraft<T>[]) {
    itemsRef.current = next;
    setItems(next);
  }
  function release(item: MessageAttachmentDraft<T>) {
    controllers.current.get(item.id)?.abort();
    controllers.current.delete(item.id);
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
  function clear() {
    itemsRef.current.forEach(release);
    replace([]);
  }
  useLayoutEffect(() => {
    activeScopeRef.current = scopeKey;
    clear();
    return () => {
      activeScopeRef.current = "";
      itemsRef.current.forEach(release);
      itemsRef.current = [];
    };
  }, [scopeKey]);

  async function addFiles(files: FileList | readonly File[] | null, clipboard = false) {
    if (disabled || !files?.length) return;
    const accepted: MessageAttachmentDraft<T>[] = [];
    for (const file of Array.from(files)) {
      if (itemsRef.current.length + accepted.length >= MESSAGE_ATTACHMENT_LIMIT) {
        onError(t("messageAttachments.limit"));
        break;
      }
      if ((!allowFiles || clipboard) && !MESSAGE_IMAGE_TYPES.includes(file.type)) {
        onError(t("messageAttachments.unsupported"));
        continue;
      }
      if ((!allowFiles || clipboard) && file.size > MESSAGE_IMAGE_MAX_BYTES) {
        onError(t("messageAttachments.tooLarge"));
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        status: stage ? "uploading" : "ready",
      });
    }
    replace([...itemsRef.current, ...accepted]);
    const uploadScope = scopeKey;
    for (const item of accepted) {
      if (
        !stage ||
        activeScopeRef.current !== uploadScope ||
        !itemsRef.current.some((current) => current.id === item.id)
      )
        continue;
      const controller = new AbortController();
      controllers.current.set(item.id, controller);
      try {
        const value = await stage(item.file, controller.signal);
        if (activeScopeRef.current !== uploadScope || controller.signal.aborted) continue;
        replace(
          itemsRef.current.map((current) =>
            current.id === item.id ? { ...current, status: "ready", value } : current,
          ),
        );
      } catch (error) {
        if (controller.signal.aborted || activeScopeRef.current !== uploadScope) continue;
        const message =
          error instanceof Error ? error.message : t("messageAttachments.uploadFailed");
        replace(
          itemsRef.current.map((current) =>
            current.id === item.id ? { ...current, status: "failed", error: message } : current,
          ),
        );
      } finally {
        controllers.current.delete(item.id);
      }
    }
  }
  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = clipboardImageFiles(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    void addFiles(files, true);
  }
  function remove(id: string) {
    const item = itemsRef.current.find((current) => current.id === id);
    if (item) release(item);
    replace(itemsRef.current.filter((current) => current.id !== id));
  }
  function updateValue(id: string, value: T) {
    replace(itemsRef.current.map((item) => (item.id === id ? { ...item, value } : item)));
  }
  return {
    items,
    addFiles,
    onPaste,
    remove,
    clear,
    updateValue,
    uploading: items.some((item) => item.status === "uploading"),
    ready: items.every((item) => item.status === "ready"),
  };
}
