// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { applySnapshot } from "mobx-state-tree";
import { runtimeStatusStore } from "../../store/runtime-status-store.js";
import { TkPrivate } from "./Privacy.js";

function setPrivacyMode(enabled: boolean) {
  applySnapshot(runtimeStatusStore.appSettings, { privacyMode: enabled });
}

afterEach(() => {
  cleanup();
  setPrivacyMode(false);
});

describe("TkPrivate", () => {
  it("marks its children so the stylesheet can mask them", () => {
    render(<TkPrivate className="shop-label">Windboss Benessere</TkPrivate>);

    const marked = screen.getByText("Windboss Benessere");
    expect(marked.tagName).toBe("SPAN");
    expect(marked.getAttribute("data-tk-private")).toBe("text");
    expect(marked.classList.contains("shop-label")).toBe(true);
  });

  it("renders the requested element type", () => {
    render(<TkPrivate as="strong">Windboss Benessere</TkPrivate>);

    expect(screen.getByText("Windboss Benessere").tagName).toBe("STRONG");
  });

  it("keeps the tooltip while privacy mode is off", () => {
    render(<TkPrivate title="Windboss Benessere">Windboss Benessere</TkPrivate>);

    expect(screen.getByText("Windboss Benessere").getAttribute("title")).toBe(
      "Windboss Benessere",
    );
  });

  it("suppresses the tooltip while privacy mode is on so hover cannot leak the name", () => {
    setPrivacyMode(true);
    render(<TkPrivate title="Windboss Benessere">Windboss Benessere</TkPrivate>);

    expect(screen.getByText("Windboss Benessere").getAttribute("title")).toBeNull();
  });

  it("re-renders when privacy mode flips", () => {
    render(<TkPrivate title="Windboss Benessere">Windboss Benessere</TkPrivate>);
    expect(screen.getByText("Windboss Benessere").getAttribute("title")).toBe(
      "Windboss Benessere",
    );

    act(() => setPrivacyMode(true));

    expect(screen.getByText("Windboss Benessere").getAttribute("title")).toBeNull();
  });

  it("passes non-sensitive children through unmarked", () => {
    render(
      <TkPrivate className="shop-label" sensitive={false} title="Ireland">
        Ireland
      </TkPrivate>,
    );

    const passthrough = screen.getByText("Ireland");
    expect(passthrough.hasAttribute("data-tk-private")).toBe(false);
    expect(passthrough.getAttribute("title")).toBe("Ireland");
    expect(passthrough.classList.contains("shop-label")).toBe(true);
  });

  it("never masks non-sensitive children, even while privacy mode is on", () => {
    setPrivacyMode(true);
    render(
      <TkPrivate sensitive={false} title="Ireland">
        Ireland
      </TkPrivate>,
    );

    const passthrough = screen.getByText("Ireland");
    expect(passthrough.hasAttribute("data-tk-private")).toBe(false);
    expect(passthrough.getAttribute("title")).toBe("Ireland");
  });

  it("switches between marked and passthrough on the same call-site shape", () => {
    // The wave-2 shape: `<TkPrivate sensitive={label.sensitive}>{label.text}</TkPrivate>`,
    // where an alias resolves non-sensitive and a shop name resolves sensitive.
    setPrivacyMode(true);
    const { rerender } = render(<TkPrivate sensitive={false}>Ireland</TkPrivate>);
    expect(screen.getByText("Ireland").hasAttribute("data-tk-private")).toBe(false);

    rerender(<TkPrivate sensitive>Windboss Benessere</TkPrivate>);
    expect(screen.getByText("Windboss Benessere").getAttribute("data-tk-private")).toBe("text");
  });
});
