import { SSE } from "@rivonclaw/core/api-contract";

/**
 * Panel event bus — singleton wrapper around a single EventSource
 * connected to Desktop's unified `/api/events` stream.
 *
 * Every Panel session opens EXACTLY ONE EventSource, regardless of how
 * many components subscribe to which events. This keeps the total SSE
 * connection count per origin at 1 (plus the one-shot `/api/doctor/run`
 * ephemeral stream), safely under Chrome's 6-connection HTTP/1.1 limit.
 *
 * Usage:
 *   const unsubscribe = panelEventBus.subscribe("oauth-complete", (data) => { ... });
 *   // later:
 *   unsubscribe();
 *
 * Payloads arrive as already-JSON.parsed `unknown`. Callers should narrow
 * via their own type guards or a documented shared type.
 */
export interface PanelEventBus {
  /** Subscribe to an event. Returns an unsubscribe function. */
  subscribe(event: string, handler: (data: unknown) => void): () => void;
  /** Close the underlying EventSource and drop all handlers. Mostly for tests. */
  disconnect(): void;
}

type Handler = (data: unknown) => void;

/**
 * Factory, exported for test isolation. Production code should use the
 * module-level `panelEventBus` singleton below.
 */
export function createPanelEventBus(
  createEventSource: (url: string) => EventSource = (url) => new EventSource(url),
): PanelEventBus {
  const handlers = new Map<string, Set<Handler>>();
  const attachedEvents = new Set<string>();
  let eventSource: EventSource | null = null;

  function ensureConnected(): EventSource {
    if (eventSource) return eventSource;
    const sse = createEventSource(SSE.events.path);
    eventSource = sse;
    sse.onerror = () => {
      // EventSource auto-reconnects transparently. On reconnect Desktop
      // re-emits entity-snapshot + status-snapshot, so the stores
      // self-heal. Log only on terminal close.
      if (sse.readyState === EventSource.CLOSED) {
        console.warn("[panel-event-bus] SSE connection closed permanently");
      }
    };
    // Re-attach listeners for any events that were subscribed before the
    // connection was opened (normal flow: subscribe() opens it).
    for (const event of attachedEvents) {
      attachListener(sse, event);
    }
    return sse;
  }

  function attachListener(sse: EventSource, event: string): void {
    sse.addEventListener(event, (e: MessageEvent) => {
      const set = handlers.get(event);
      if (!set || set.size === 0) return;
      let payload: unknown;
      try {
        payload = JSON.parse(e.data);
      } catch (err) {
        console.warn(`[panel-event-bus] malformed data for event "${event}":`, err);
        return;
      }
      // Copy to array to guard against handlers that unsubscribe during dispatch.
      for (const handler of Array.from(set)) {
        handler(payload);
      }
    });
  }

  return {
    subscribe(event, handler) {
      const sse = ensureConnected();

      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler);

      if (!attachedEvents.has(event)) {
        attachedEvents.add(event);
        attachListener(sse, event);
      }

      return () => {
        const s = handlers.get(event);
        if (!s) return;
        s.delete(handler);
        // Intentionally keep attachedEvents/listener — re-subscribing is
        // cheap and detaching per-name EventSource listeners adds no
        // measurable win. Size of `set` is small.
      };
    },

    disconnect() {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      handlers.clear();
      attachedEvents.clear();
    },
  };
}

/** Singleton — the one bus per Panel session. */
export const panelEventBus: PanelEventBus = createPanelEventBus();
