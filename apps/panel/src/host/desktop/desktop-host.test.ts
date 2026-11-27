import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpLink } from "@apollo/client";
import { API } from "@rivonclaw/core/api-contract";
import { HOST_CAPABILITIES } from "../host-adapter.js";
import { createDesktopHost } from "./desktop-host.js";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static readonly CLOSED = 2;
  readyState = 1;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, Set<(e: MessageEvent) => void>>();
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(event: string, fn: (e: MessageEvent) => void) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(fn);
    this.listeners.set(event, set);
  }
  close() {}
  emit(event: string, data: unknown) {
    for (const fn of this.listeners.get(event) ?? []) {
      fn({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
}

afterEach(() => {
  FakeEventSource.instances = [];
  vi.unstubAllGlobals();
});

describe("Desktop host", () => {
  it("is the desktop kind and provides every capability", () => {
    const host = createDesktopHost();
    expect(host.kind).toBe("desktop");
    for (const capability of HOST_CAPABILITIES) expect(host.capabilities.has(capability)).toBe(true);
  });

  it("opens no connection until something subscribes, then exactly one to /api/events", () => {
    const host = createDesktopHost({
      createEventSource: (url) => new FakeEventSource(url) as unknown as EventSource,
    });
    expect(FakeEventSource.instances).toHaveLength(0);

    const entity = vi.fn();
    const oauth = vi.fn();
    host.events.subscribe("entity-snapshot", entity);
    host.events.subscribe("oauth-complete", oauth);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]!.url).toBe("/api/events");

    FakeEventSource.instances[0]!.emit("entity-snapshot", { shops: [] });
    FakeEventSource.instances[0]!.emit("oauth-complete", { ok: true });
    expect(entity).toHaveBeenCalledWith({ shops: [] });
    expect(oauth).toHaveBeenCalledWith({ ok: true });
  });

  it("sends GraphQL to Desktop's cloud proxy", () => {
    const link = createDesktopHost().graphql.createLink();
    expect(link).toBeInstanceOf(HttpLink);
    expect(API["cloud.graphql"].path).toBe("/api/cloud/graphql");
  });

  it("sends cloud REST to the given Desktop proxy path unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const init = { method: "POST" };
    await createDesktopHost().cloud.fetch("/api/cloud/uploads/images", init);
    expect(fetchMock).toHaveBeenCalledWith("/api/cloud/uploads/images", init);
  });
});
