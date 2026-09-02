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
