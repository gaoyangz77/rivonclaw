import { describe, expect, it } from "vitest";
import { buildProxyEnv } from "./proxy-manager.js";

describe("buildProxyEnv", () => {
  it("routes gateway network through proxy-router and disables runtime trajectory recording", () => {
    const env = buildProxyEnv(18888);

    expect(env.HTTP_PROXY).toBe("http://127.0.0.1:18888");
    expect(env.HTTPS_PROXY).toBe("http://127.0.0.1:18888");
    expect(env.NO_PROXY).toContain("127.0.0.1");
    expect(env.OPENCLAW_TRAJECTORY).toBe("0");
  });
});
