import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOfficeScreensaver } from "./useOfficeScreensaver.js";

const listeners = new Set<(payload: unknown) => void>();

vi.mock("../../lib/event-bus.js", () => ({
  panelEventBus: {
    subscribe: (_event: string, handler: (payload: unknown) => void) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
  },
}));

function setIdle(idle: boolean) {
  act(() => {
    for (const handler of listeners) handler({ idle });
  });
}

describe("useOfficeScreensaver", () => {
  beforeEach(() => listeners.clear());

  it("stays closed while the machine is in use", () => {
    const { result } = renderHook(() => useOfficeScreensaver());
    expect(result.current.active).toBe(false);
  });

  it("opens when the machine goes unattended", () => {
    const { result } = renderHook(() => useOfficeScreensaver());
    setIdle(true);
    expect(result.current.active).toBe(true);
  });

  it("opens on request even while the machine is in use", () => {
    const { result } = renderHook(() => useOfficeScreensaver());
    act(() => result.current.open());
    expect(result.current.active).toBe(true);
  });

  it("closes on request", () => {
    const { result } = renderHook(() => useOfficeScreensaver());
    setIdle(true);
    act(() => result.current.close());
    expect(result.current.active).toBe(false);
  });

  // The OS idle timer is polled, so a viewer who returns is still reported idle
  // for a moment. Without the latch the office reappears in their face.
  it("does not immediately reopen after being dismissed while still idle", () => {
    const { result } = renderHook(() => useOfficeScreensaver());
    setIdle(true);
    act(() => result.current.close());
    setIdle(true);
    expect(result.current.active).toBe(false);
  });

  it("re-arms once activity is observed", () => {
    const { result } = renderHook(() => useOfficeScreensaver());
    setIdle(true);
    act(() => result.current.close());
    setIdle(false);
    setIdle(true);
    expect(result.current.active).toBe(true);
  });

  // Closing a manually opened office must not arm a latch: the machine was
  // never idle, so nothing will ever clear it and the screensaver would be
  // disabled for the rest of the session. Found by driving a real Panel.
  it("still auto-opens after a manual open and close while in use", () => {
    const { result } = renderHook(() => useOfficeScreensaver());
    act(() => result.current.open());
    act(() => result.current.close());
    setIdle(true);
    expect(result.current.active).toBe(true);
  });
});
