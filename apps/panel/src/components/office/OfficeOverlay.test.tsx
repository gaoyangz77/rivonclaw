// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfficeOverlay } from "./OfficeOverlay.js";

const host = vi.hoisted(() => ({
  start: vi.fn(),
  applyScene: vi.fn(),
  dispose: vi.fn(),
}));

// The bus hands a late subscriber the last snapshot synchronously, inside
// `subscribe` - that is the real bus's behaviour and the timing under test.
const bus = vi.hoisted(() => ({
  replay: null as unknown,
  subscribe: vi.fn((_event: string, handler: (payload: unknown) => void) => {
    if (bus.replay) handler(bus.replay);
    return () => {};
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../../lib/event-bus.js", () => ({ panelEventBus: bus }));
vi.mock("@rivonclaw/pixel-agents-bridge", () => ({
  // A `function`, not an arrow: the overlay calls `new OfficeHost(...)`.
  OfficeHost: vi.fn(function OfficeHostMock() {
    return host;
  }),
  createIframeFrame: vi.fn(() => ({ post: vi.fn(), onMessage: vi.fn(() => () => {}) })),
}));

const SNAPSHOT = { contractVersion: 1, revision: 7, rooms: [], desks: [], characters: [] };
const ASSETS = { layout: { cols: 31, rows: 18, areas: [] } };

describe("OfficeOverlay", () => {
  let resolveAssets: () => void = () => {};

  beforeEach(() => {
    host.start.mockClear();
    host.applyScene.mockClear();
    host.dispose.mockClear();
    bus.subscribe.mockClear();
    bus.replay = null;
    // Assets resolve only when the test says so, which is how the scene is made
    // to arrive first.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveAssets = () =>
              resolve({ ok: true, json: () => Promise.resolve(ASSETS) } as Response);
          }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // Found on a quiet Desktop: the office opened with every desk empty and
  // stayed that way. The scene had arrived - replayed by the bus the instant
  // the overlay subscribed - but before the assets, so before there was a host
  // to give it to, and Desktop sends nothing further while nothing changes.
  // Seen from a nested route: a relative `./office/...` resolved against
  // `/commerce/shops` and 404ed, which the overlay reports as "this build has
  // no office". The paths must be root-absolute whatever route is open.
  it("loads the office from the static root regardless of the current route", async () => {
    window.history.pushState({}, "", "/commerce/shops");
    render(<OfficeOverlay onExit={() => {}} />);
    expect(fetch).toHaveBeenCalledWith("/office/scene-assets.json");

    resolveAssets();
    await waitFor(() => expect(host.start).toHaveBeenCalled());
    const iframe = document.querySelector("iframe") as HTMLIFrameElement;
    expect(new URL(iframe.src, window.location.origin).pathname).toBe("/office/index.html");
  });

  it("applies a scene that arrived before the renderer host existed", async () => {
    bus.replay = { snapshot: SNAPSHOT, cues: [] };
    render(<OfficeOverlay onExit={() => {}} />);
    expect(bus.subscribe).toHaveBeenCalledWith("scene-snapshot", expect.any(Function));
    expect(host.applyScene).not.toHaveBeenCalled();

    resolveAssets();

    await waitFor(() => expect(host.start).toHaveBeenCalled());
    expect(host.applyScene).toHaveBeenCalledWith(SNAPSHOT);
  });

  // Desktop coalesces snapshots, so a run's setup sequence arrives as one
  // snapshot showing only its last state; the transitions it dropped travel in
  // the cues, and an overlay that forwards only the snapshot loses them.
  it("forwards scenes, and the cues behind them, once the host exists", async () => {
    render(<OfficeOverlay onExit={() => {}} />);
    resolveAssets();
    await waitFor(() => expect(host.start).toHaveBeenCalled());
    expect(host.applyScene).not.toHaveBeenCalled();

    const [, handler] = bus.subscribe.mock.calls[0] as [string, (payload: unknown) => void];
    const later = { ...SNAPSHOT, revision: 8 };
    const cues = [{ kind: "statusChanged", characterId: "lease-1", status: "arriving" }];
    await waitFor(() => {
      handler({ snapshot: later, cues });
      expect(host.applyScene).toHaveBeenCalledWith(later, cues);
    });
  });
});
