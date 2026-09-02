import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Unmount every tree React Testing Library rendered, after every test.
 *
 * RTL registers this itself, but only `if (typeof afterEach === "function")` -
 * i.e. only when the runner installs globals. This project runs with Vitest's
 * default `globals: false` and every test imports `describe`/`it` explicitly,
 * so that check fails and RTL's auto-cleanup never registers. Without it no
 * component in the suite is ever unmounted, so no `useEffect` cleanup ever
 * runs: 74 cleanup closures across 45 component files are dead code under test.
 *
 * The visible symptom was an intermittent `ReferenceError: window is not
 * defined` that failed the whole run while all 887 tests passed. A tree left
 * mounted keeps its timers, `requestAnimationFrame` callbacks and `window`
 * listeners alive (TkTooltip holds all three while open), and when Vitest tore
 * the worker's jsdom down, whichever callback was still pending dereferenced a
 * `window` that no longer existed. The blamed test file was wherever the run
 * happened to be, which is why the attribution drifted between files.
 *
 * Registering it explicitly is also the honest form: the suite does not rely on
 * globals anywhere else, so it should not rely on them here either.
 */
afterEach(cleanup);

/**
 * jsdom lacks APIs the Panel legitimately uses in a browser.
 *
 * `EventSource` is one: the Panel opens exactly one to Desktop's `/api/events`
 * stream, and any component that subscribes through `panelEventBus` will
 * construct it on mount. Stubbing it here rather than in the production bus
 * keeps the bus honest - it should fail loudly in a real browser that cannot
 * open the stream, and only the test environment needs the stand-in.
 *
 * The stub never emits. A test that needs events builds its own bus with
 * `createPanelEventBus(fakeFactory)`.
 */
class StubEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState = StubEventSource.OPEN;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
  onopen: ((this: EventSource, ev: Event) => unknown) | null = null;

  constructor(readonly url: string) {}

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return false;
  }
  close(): void {
    this.readyState = StubEventSource.CLOSED;
  }
}

if (typeof globalThis.EventSource === "undefined") {
  (globalThis as { EventSource?: unknown }).EventSource =
    StubEventSource as unknown as typeof EventSource;
}
