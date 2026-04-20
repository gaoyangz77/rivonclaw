import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPanelEventBus } from "./event-bus.js";

// ─── Fake EventSource ───────────────────────────────────────────────────────

type Listener = (e: MessageEvent) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CLOSED = 2;
  static readonly OPEN = 1;
  readyState: number = FakeEventSource.OPEN;
  onerror: ((e: Event) => void) | null = null;
  private listeners = new Map<string, Set<Listener>>();

  constructor(public readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(event: string, fn: Listener): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
  }

  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }

  /** Test helper: simulate server pushing a named event. */
  emit(event: string, data: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    const msg = { data: JSON.stringify(data) } as MessageEvent;
    for (const fn of set) fn(msg);
  }
}

beforeEach(() => {
  FakeEventSource.instances.length = 0;
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("createPanelEventBus", () => {
  it("opens the EventSource lazily on first subscribe", () => {
    const bus = createPanelEventBus((url) => new FakeEventSource(url) as unknown as EventSource);
    expect(FakeEventSource.instances.length).toBe(0);

    bus.subscribe("ping", () => {});
    expect(FakeEventSource.instances.length).toBe(1);

    bus.subscribe("pong", () => {});
    // Still one — lazily reuse the same connection.
    expect(FakeEventSource.instances.length).toBe(1);
  });

  it("delivers a payload to a single subscriber", () => {
    const bus = createPanelEventBus((url) => new FakeEventSource(url) as unknown as EventSource);
    const handler = vi.fn();
    bus.subscribe("oauth-complete", handler);

    const source = FakeEventSource.instances[0]!;
    source.emit("oauth-complete", { shopId: "s1" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ shopId: "s1" });
  });

  it("fan-outs a single event to every subscriber", () => {
    const bus = createPanelEventBus((url) => new FakeEventSource(url) as unknown as EventSource);
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.subscribe("inbound", h1);
    bus.subscribe("inbound", h2);

    const source = FakeEventSource.instances[0]!;
    source.emit("inbound", { sessionKey: "sk-1" });

    expect(h1).toHaveBeenCalledWith({ sessionKey: "sk-1" });
    expect(h2).toHaveBeenCalledWith({ sessionKey: "sk-1" });
  });

  it("routes different events independently", () => {
    const bus = createPanelEventBus((url) => new FakeEventSource(url) as unknown as EventSource);
    const onA = vi.fn();
    const onB = vi.fn();
    bus.subscribe("a", onA);
    bus.subscribe("b", onB);

    const source = FakeEventSource.instances[0]!;
    source.emit("a", { v: 1 });
    source.emit("b", { v: 2 });

    expect(onA).toHaveBeenCalledTimes(1);
    expect(onA).toHaveBeenCalledWith({ v: 1 });
    expect(onB).toHaveBeenCalledTimes(1);
    expect(onB).toHaveBeenCalledWith({ v: 2 });
  });

  it("unsubscribe stops delivery for that handler only", () => {
    const bus = createPanelEventBus((url) => new FakeEventSource(url) as unknown as EventSource);
    const keep = vi.fn();
    const drop = vi.fn();
    bus.subscribe("evt", keep);
    const unsubscribe = bus.subscribe("evt", drop);
    unsubscribe();

    const source = FakeEventSource.instances[0]!;
    source.emit("evt", { x: 1 });

    expect(keep).toHaveBeenCalledTimes(1);
    expect(drop).not.toHaveBeenCalled();
  });

  it("swallows malformed JSON without throwing", () => {
    const bus = createPanelEventBus((url) => new FakeEventSource(url) as unknown as EventSource);
    const handler = vi.fn();
    bus.subscribe("broken", handler);

    const source = FakeEventSource.instances[0]!;
    const set = (source as unknown as { listeners: Map<string, Set<Listener>> }).listeners.get("broken");
    const fn = Array.from(set!)[0]!;
    expect(() => fn({ data: "{not-json" } as MessageEvent)).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("disconnect closes the source and drops handlers", () => {
    const bus = createPanelEventBus((url) => new FakeEventSource(url) as unknown as EventSource);
    const handler = vi.fn();
    bus.subscribe("x", handler);

    const source = FakeEventSource.instances[0]!;
    bus.disconnect();
    expect(source.readyState).toBe(FakeEventSource.CLOSED);

    // Second subscribe opens a fresh connection.
    bus.subscribe("y", () => {});
    expect(FakeEventSource.instances.length).toBe(2);
  });
});
