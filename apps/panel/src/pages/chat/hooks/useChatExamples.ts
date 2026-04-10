import { useState } from "react";
import { fetchSettings, updateSettings } from "../../../api/index.js";

export function useChatExamples() {
  const [chatExamplesExpanded, setChatExamplesExpanded] = useState(
    () => localStorage.getItem("chat-examples-collapsed") !== "1"
  );
  const [customExamples, setCustomExamples] = useState<Record<string, string>>({});
  const [editingExample, setEditingExample] = useState<string | null>(null);
  const [editingExampleDraft, setEditingExampleDraft] = useState("");

  /** Load custom examples from settings (called once from connection init). */
  function loadFromSettings() {
    fetchSettings().then((s) => {
      try {
        const raw = s["chat-example-prompts"];
        if (raw) setCustomExamples(JSON.parse(raw));
      } catch { /* ignore invalid JSON */ }
    }).catch(() => {});
  }

  function toggleExpanded() {
    const next = !chatExamplesExpanded;
    setChatExamplesExpanded(next);
    localStorage.setItem("chat-examples-collapsed", next ? "0" : "1");
    updateSettings({ chat_examples_collapsed: next ? "0" : "1" }).catch(() => {});
  }

  function saveExample(key: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next = { ...customExamples, [key]: trimmed };
    setCustomExamples(next);
    updateSettings({ "chat-example-prompts": JSON.stringify(next) }).catch(() => {});
    setEditingExample(null);
  }

  function restoreDefault(key: string) {
    const next = { ...customExamples };
    delete next[key];
    setCustomExamples(next);
    const json = JSON.stringify(next);
    updateSettings({ "chat-example-prompts": Object.keys(next).length ? json : "" }).catch(() => {});
    setEditingExample(null);
  }

  return {
    chatExamplesExpanded,
    customExamples,
    editingExample,
    editingExampleDraft,
    setEditingExample,
    setEditingExampleDraft,
    toggleExpanded,
    saveExample,
    restoreDefault,
    loadFromSettings,
  };
}
