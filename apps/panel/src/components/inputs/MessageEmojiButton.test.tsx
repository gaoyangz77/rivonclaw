import { useRef, useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n/index.js";
import { TkComposer, TkModal } from "../design-system/index.js";
import { MessageEmojiButton } from "./MessageEmojiButton.js";

vi.mock("./MessageEmojiPicker.js", () => ({
  default: ({ onSelect }: { onSelect: (emoji: string) => void }) => (
    <button type="button" onClick={() => onSelect("😊")}>
      😊
    </button>
  ),
}));

function Composer({ initial = "", disabled = false, onSubmit = vi.fn() }) {
  const [draft, setDraft] = useState(initial);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  return (
    <TkComposer
      value={draft}
      onValueChange={setDraft}
      onSubmit={onSubmit}
      submitLabel="Send"
      placeholder="Reply"
      disabled={disabled}
      textareaRef={textareaRef}
      tools={
        <MessageEmojiButton
          textareaRef={textareaRef}
          onValueChange={setDraft}
          disabled={disabled}
        />
      }
    />
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});

describe("message emoji input", () => {
  it("closes only the picker on Escape inside a conversation modal", async () => {
    const onClose = vi.fn();
    render(
      <TkModal isOpen title="Conversation" onClose={onClose}>
        <Composer />
      </TkModal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "表情" }));
    const picker = await screen.findByRole("dialog", { name: "表情" });
    fireEvent.keyDown(picker, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Conversation" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "表情" })).toBeNull();
  });
  it.each([
    {
      initial: "Hola 👩🏽‍💻 equipo",
      start: "Hola 👩🏽‍💻".length,
      end: "Hola 👩🏽‍💻".length,
      expected: "Hola 👩🏽‍💻😊 equipo",
    },
    { initial: "Gracias [nombre]", start: 8, end: 16, expected: "Gracias 😊" },
    { initial: "", start: 0, end: 0, expected: "😊" },
  ])(
    "inserts at the saved selection without sending: $initial",
    async ({ initial, start, end, expected }) => {
      const onSubmit = vi.fn();
      render(<Composer initial={initial} onSubmit={onSubmit} />);
      const input = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Reply" });
      input.focus();
      input.setSelectionRange(start, end);
      fireEvent.click(screen.getByRole("button", { name: "表情" }));
      const panel = await screen.findByRole("dialog", { name: "表情" });
      const emoji = await within(panel).findByRole("button", { name: "😊" });
      fireEvent.click(emoji);
      await waitFor(() => {
        expect(input.value).toBe(expected);
        expect(document.activeElement).toBe(input);
        expect(input.selectionStart).toBe(start + "😊".length);
        expect(input.selectionEnd).toBe(input.selectionStart);
      });
      expect(screen.queryByRole("dialog", { name: "表情" })).toBeNull();
      expect(onSubmit).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      expect(onSubmit).toHaveBeenCalledOnce();
    },
  );

  it("closes on Escape and outside clicks, and is unavailable while sending", async () => {
    const { rerender } = render(<Composer />);
    const trigger = screen.getByRole<HTMLButtonElement>("button", { name: "表情" });
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: "表情" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "表情" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "表情" })).toBeNull();
    fireEvent.click(trigger);
    rerender(<Composer disabled />);
    expect(trigger.disabled).toBe(true);
    expect(screen.queryByRole("dialog", { name: "表情" })).toBeNull();
    rerender(<Composer />);
    expect(screen.queryByRole("dialog", { name: "表情" })).toBeNull();
  });
});
