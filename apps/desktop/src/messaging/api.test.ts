import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { RouteRegistry } from "../infra/api/route-registry.js";
import { registerMessagingHandlers } from "./api.js";
const translate = vi.hoisted(() => vi.fn());
vi.mock("./translation-service.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./translation-service.js")>()),
  translateMessage: translate,
}));
async function dispatch(body: unknown, token: string | null = "signed-in") {
  const registry = new RouteRegistry();
  registerMessagingHandlers(registry);
  const req = Readable.from([Buffer.from(JSON.stringify(body))]) as IncomingMessage;
  req.method = "POST";
  const response = {
    status: 0,
    payload: {} as any,
    writeHead(code: number) {
      this.status = code;
    },
    end(data: string) {
      this.payload = JSON.parse(data);
    },
  };
  const url = new URL("http://localhost/api/messaging/translate");
  await registry.dispatch(req, response as unknown as ServerResponse, url, url.pathname, {
    authSession: { getAccessToken: () => token },
  });
  return response;
}
describe("translation local API", () => {
  it("requires sign-in", async () => {
    translate.mockClear();
    expect((await dispatch({}, null)).status).toBe(401);
    expect(translate).not.toHaveBeenCalled();
  });
  it("rejects bad input before calling model", async () => {
    translate.mockClear();
    expect((await dispatch({})).status).toBe(400);
    expect(translate).not.toHaveBeenCalled();
  });
  it("returns prepared text only", async () => {
    translate.mockResolvedValue({ language: "es", source: "site", text: "Hola" });
    const result = await dispatch({ text: "你好", fallbackLanguage: "es" });
    expect(result.status).toBe(200);
    expect(result.payload.text).toBe("Hola");
  });
  it("surfaces generation failures", async () => {
    translate.mockRejectedValue(new Error("Model unavailable"));
    const result = await dispatch({ text: "你好", fallbackLanguage: "es" });
    expect(result.status).toBe(502);
    expect(result.payload.error).toBe("Model unavailable");
  });
});
