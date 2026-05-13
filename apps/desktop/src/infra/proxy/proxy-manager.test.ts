import { describe, expect, it } from "vitest";
import { buildProxyEnv } from "./proxy-manager.js";

describe("buildProxyEnv", () => {
  it("routes gateway network through proxy-router and disables runtime trajectory recording", () => {
    const env = buildProxyEnv(18888);

    expect(env.HTTP_PROXY).toBe("http://127.0.0.1:18888");
    expect(env.HTTPS_PROXY).toBe("http://127.0.0.1:18888");
    expect(env.NO_PROXY).toContain("127.0.0.1");
    expect(env.no_proxy).toContain("127.0.0.1");
    expect(env.OPENCLAW_TRAJECTORY).toBe("0");
    expect(env.OPENCLAW_DISABLE_OUTBOUND_DELIVERY_RECOVERY).toBe("1");
    expect(env.OPENCLAW_DISABLE_SESSION_RESTART_RECOVERY).toBe("1");
  });

  it("bypasses proxy for Weixin QR login hosts", () => {
    const env = buildProxyEnv(18888);

    expect(env.NO_PROXY).toContain("ilinkai.weixin.qq.com");
    expect(env.NO_PROXY).toContain("liteapp.weixin.qq.com");
    expect(env.no_proxy).toContain("ilinkai.weixin.qq.com");
    expect(env.no_proxy).toContain("liteapp.weixin.qq.com");
  });
});
