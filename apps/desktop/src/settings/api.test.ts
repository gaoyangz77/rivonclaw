import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiContext } from "../app/api-context.js";
import { RouteRegistry } from "../infra/api/route-registry.js";
import { registerSettingsHandlers } from "./api.js";

let registry: RouteRegistry;

beforeEach(() => {
  registry = new RouteRegistry();
  registerSettingsHandlers(registry);
});

function makeRequest(origin?: string): IncomingMessage {
  const request = new Readable({ read() {} });
  request.push(null);
  (request as IncomingMessage).method = "POST";
  (request as IncomingMessage).headers = origin ? { origin } : {};
  return request as IncomingMessage;
}

function makeResponse(): ServerResponse & { status: number; body: unknown } {
  const response = {
    status: 0,
    body: null as unknown,
    writeHead(status: number) {
      response.status = status;
      return response;
    },
    end(data?: string) {
      if (data) response.body = JSON.parse(data);
    },
  } as unknown as ServerResponse & { status: number; body: unknown };
  return response;
}

async function dispatch(origin?: string, context: Partial<ApiContext> = {}) {
  const request = makeRequest(origin);
  const response = makeResponse();
  const url = new URL("http://localhost/api/app/open-in-browser");
  const handled = await registry.dispatch(
    request,
    response,
    url,
    url.pathname,
    context as ApiContext,
  );
  return { handled, response };
}

describe("POST /api/app/open-in-browser", () => {
  it("opens the current Panel port on localhost", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);

    const { handled, response } = await dispatch("http://127.0.0.1:43127", {
      getPanelUrl: () => "http://127.0.0.1:43127",
      openExternal,
    });

    expect(handled).toBe(true);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(openExternal).toHaveBeenCalledWith("http://localhost:43127/");
  });

  it("rejects requests from a non-loopback origin", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);

    const { response } = await dispatch("https://attacker.example", {
      getPanelUrl: () => "http://127.0.0.1:43127",
      openExternal,
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      errorCode: "APP_OPEN_IN_BROWSER_UNTRUSTED_ORIGIN",
    });
    expect(openExternal).not.toHaveBeenCalled();
  });
});
