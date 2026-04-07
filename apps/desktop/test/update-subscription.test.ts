import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
} from "graphql";
import { EventEmitter } from "node:events";
import { setApiBaseUrlOverride } from "@rivonclaw/core";
import {
  BackendSubscriptionClient,
  type UpdatePayload,
} from "../src/cloud/backend-subscription-client.js";

/* ---------- mock GraphQL server ---------- */

interface StoredUpdate {
  version: string;
  downloadUrl?: string;
}

function buildMockServer() {
  /** The version the server considers "latest" at connect time. */
  let storedUpdate: StoredUpdate | null = null;

  /** Emitter for runtime (admin) pushes. */
  const pushEmitter = new EventEmitter();

  const UpdatePayloadType = new GraphQLObjectType({
    name: "UpdatePayload",
    fields: {
      version: { type: new GraphQLNonNull(GraphQLString) },
      downloadUrl: { type: GraphQLString },
    },
  });

  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: {
        _unused: { type: GraphQLString, resolve: () => "ok" },
      },
    }),
    subscription: new GraphQLObjectType({
      name: "Subscription",
      fields: {
        updateAvailable: {
          type: UpdatePayloadType,
          args: {
            clientVersion: { type: new GraphQLNonNull(GraphQLString) },
          },
          subscribe: (_root, args) => {
            const clientVersion = args.clientVersion as string;
            let done = false;

            /* Simple async iterator that yields stored update + listens for pushes */
            const queue: StoredUpdate[] = [];
            let waiting: ((value: IteratorResult<StoredUpdate>) => void) | null =
              null;

            function enqueue(payload: StoredUpdate) {
              if (waiting) {
                const resolve = waiting;
                waiting = null;
                resolve({ value: payload, done: false });
              } else {
                queue.push(payload);
              }
            }

            /* Connect-time pull: server sends stored version if it exists */
            if (storedUpdate) {
              queue.push(storedUpdate);
            }

            /* Listen for admin pushes */
            const onPush = (payload: StoredUpdate) => {
              if (!done) enqueue(payload);
            };
            pushEmitter.on("push", onPush);

            const iterator: AsyncIterableIterator<StoredUpdate> = {
              next() {
                if (queue.length > 0) {
                  return Promise.resolve({
                    value: queue.shift()!,
                    done: false,
                  });
                }
                return new Promise((resolve) => {
                  waiting = resolve;
                });
              },
              return() {
                done = true;
                pushEmitter.off("push", onPush);
                return Promise.resolve({ value: undefined as any, done: true });
              },
              [Symbol.asyncIterator]() {
                return this;
              },
            };

            return iterator;
          },
          resolve: (payload: StoredUpdate) => payload,
        },
      },
    }),
  });

  return {
    schema,
    setStoredUpdate(update: StoredUpdate | null) {
      storedUpdate = update;
    },
    pushUpdate(payload: StoredUpdate) {
      pushEmitter.emit("push", payload);
    },
  };
}

/* ---------- test suite ---------- */

describe("BackendSubscriptionClient", () => {
  let httpServer: Server;
  let wsServer: WebSocketServer;
  let gqlServerCleanup: { dispose: () => Promise<void> };
  let port: number;
  let mockServer: ReturnType<typeof buildMockServer>;
  let client: BackendSubscriptionClient | null = null;

  beforeAll(
    async () => {
      mockServer = buildMockServer();

      httpServer = createServer((_req, res) => {
        res.writeHead(404);
        res.end();
      });

      await new Promise<void>((resolve) => {
        httpServer.listen(0, "127.0.0.1", () => resolve());
      });

      port = (httpServer.address() as { port: number }).port;

      wsServer = new WebSocketServer({
        server: httpServer,
        path: "/graphql",
      });

      gqlServerCleanup = useServer({ schema: mockServer.schema }, wsServer);

      setApiBaseUrlOverride(`http://127.0.0.1:${port}`);
    },
    10_000,
  );

  afterEach(() => {
    client?.disconnect();
    client = null;
    mockServer.setStoredUpdate(null);
  });

  afterAll(async () => {
    client?.disconnect();
    await gqlServerCleanup.dispose();
    wsServer.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  /**
   * Helper: create a client and wait for an update (or a timeout).
   * Returns a promise that resolves with the received payload or null on timeout.
   */
  function waitForUpdate(
    currentVersion: string,
    timeoutMs: number = 3_000,
  ): { client: BackendSubscriptionClient; result: Promise<UpdatePayload | null> } {
    let resolveFn: (value: UpdatePayload | null) => void;
    const result = new Promise<UpdatePayload | null>((resolve) => {
      resolveFn = resolve;
    });

    const timer = setTimeout(() => resolveFn(null), timeoutMs);

    const onUpdate = (payload: UpdatePayload) => {
      clearTimeout(timer);
      resolveFn(payload);
    };

    const c = new BackendSubscriptionClient("en");
    c.connect(() => "test-token");
    c.subscribeToUpdates(currentVersion, onUpdate);
    client = c;

    return { client: c, result };
  }

  it("connect-time pull: receives stored version when it is newer", async () => {
    mockServer.setStoredUpdate({
      version: "2.0.0",
    });

    const { result } = waitForUpdate("1.0.0");
    const payload = await result;

    expect(payload).not.toBeNull();
    expect(payload!.version).toBe("2.0.0");
  });

  it("connect-time pull ignored: no event when stored version is not newer", async () => {
    mockServer.setStoredUpdate({ version: "1.0.0" });

    const { result } = waitForUpdate("1.0.0", 1_500);
    const payload = await result;

    expect(payload).toBeNull();
  });

  it("admin push: receives runtime-published update", async () => {
    // No stored update — connect-time pull should not fire
    mockServer.setStoredUpdate(null);

    const onUpdate = vi.fn<(payload: UpdatePayload) => void>();
    const c = new BackendSubscriptionClient("en");
    c.connect(() => "test-token");
    c.subscribeToUpdates("1.0.0", onUpdate);
    client = c;

    // Wait for the subscription to be established
    await new Promise((r) => setTimeout(r, 500));

    mockServer.pushUpdate({
      version: "3.0.0",
      downloadUrl: "https://example.com/download",
    });

    // Wait for the pushed update to arrive
    await vi.waitFor(
      () => {
        expect(onUpdate).toHaveBeenCalledTimes(1);
      },
      { timeout: 3_000, interval: 50 },
    );

    const payload = onUpdate.mock.calls[0][0];
    expect(payload.version).toBe("3.0.0");
    expect(payload.downloadUrl).toBe("https://example.com/download");
  });

  it("stale push ignored: no callback when pushed version is not newer", async () => {
    mockServer.setStoredUpdate(null);

    const onUpdate = vi.fn<(payload: UpdatePayload) => void>();
    const c = new BackendSubscriptionClient("en");
    c.connect(() => "test-token");
    c.subscribeToUpdates("2.0.0", onUpdate);
    client = c;

    // Wait for the subscription to be established
    await new Promise((r) => setTimeout(r, 500));

    mockServer.pushUpdate({ version: "1.5.0" });

    // Give time for the message to arrive and be processed
    await new Promise((r) => setTimeout(r, 1_000));

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
