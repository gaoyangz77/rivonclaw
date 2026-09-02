// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOfficeShutter } from "./useOfficeShutter.js";

// Mirrors the real hook's contract: `open`/`close` move `active`, and the
// shutter follows `active` once the finger lets go.
const screensaver = vi.hoisted(() => {
  const state = {
    active: false,
    open: vi.fn(() => {
      state.active = true;
    }),
    close: vi.fn(() => {
      state.active = false;
    }),
  };
  return state;
});

vi.mock("./useOfficeScreensaver.js", () => ({
  useOfficeScreensaver: () => screensaver,
}));

/**
 * A drag surface in the document, so events fired on it bubble up to the
 * window listeners the hook installs; jsdom has no pointer capture.
 */
function surface(): HTMLDivElement {
  const el = document.createElement("div");
  (el as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
  document.body.appendChild(el);
  return el;
}

function pointer(el: HTMLElement, type: string, clientY: number): void {
  act(() => {
    el.dispatchEvent(new MouseEvent(type, { clientY, bubbles: true }));
  });
}

describe("useOfficeShutter", () => {
  beforeEach(() => {
    screensaver.active = false;
    screensaver.open.mockClear();
    screensaver.close.mockClear();
    Object.defineProperty(window, "innerHeight", { value: 1000, configurable: true });
  });

  // The app is the shutter door and the office is behind it, so lifting the
  // door's lower edge - dragging UP - is what opens the office.
  it("opens as the door is dragged up, and snaps open past the threshold", () => {
    const { result } = renderHook(() => useOfficeShutter());
    const el = surface();

    act(() => result.current.beginDrag(900, el));
    pointer(el, "pointermove", 700);
    expect(result.current.openness).toBeCloseTo(0.2);
    expect(result.current.dragging).toBe(true);

    pointer(el, "pointerup", 500);
    expect(screensaver.open).toHaveBeenCalled();
    expect(result.current.openness).toBe(1);
    expect(result.current.dragging).toBe(false);
  });

  // The handle re-renders the instant a drag starts (the door begins to
  // move), so the element that took the pointerdown may be gone by the time
  // the finger lets go. A release that only a detached element would hear is
  // a drag that never ends - and a handle that never comes back.
  it("ends a drag whose source element was removed mid-drag", () => {
    const { result } = renderHook(() => useOfficeShutter());
    const el = surface();
    document.body.appendChild(el);

    act(() => result.current.beginDrag(900, el));
    el.remove();
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientY: 850 }));
    });
    expect(result.current.openness).toBeCloseTo(0.05);

    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup", { clientY: 880 }));
    });
    expect(result.current.dragging).toBe(false);
    expect(result.current.openness).toBe(0);
    expect(screensaver.close).toHaveBeenCalled();
  });

  it("falls back down when the lift was too short", () => {
    const { result } = renderHook(() => useOfficeShutter());
    const el = surface();

    act(() => result.current.beginDrag(900, el));
    pointer(el, "pointerup", 800);
    expect(screensaver.close).toHaveBeenCalled();
    expect(result.current.openness).toBe(0);
  });

  it("closes when the rolled-up door is pulled back down far enough", () => {
    screensaver.active = true;
    const { result } = renderHook(() => useOfficeShutter());
    expect(result.current.openness).toBe(1);
    const el = surface();

    act(() => result.current.beginDrag(100, el));
    pointer(el, "pointermove", 400);
    expect(result.current.openness).toBeCloseTo(0.7);

    pointer(el, "pointerup", 900);
    expect(screensaver.close).toHaveBeenCalled();
    expect(result.current.openness).toBe(0);
  });
});
