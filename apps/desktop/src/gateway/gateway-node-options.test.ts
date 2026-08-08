import { describe, expect, it } from "vitest";
import {
  GATEWAY_MAX_OLD_SPACE_SIZE_MB,
  buildGatewayNodeOptions,
} from "./gateway-node-options.js";

describe("buildGatewayNodeOptions", () => {
  it("raises the gateway heap limit without dropping the proxy preload", () => {
    expect(buildGatewayNodeOptions("C:\\Users\\AI User\\proxy-setup.cjs")).toBe(
      `--max-old-space-size=${GATEWAY_MAX_OLD_SPACE_SIZE_MB} --require "C:/Users/AI User/proxy-setup.cjs"`,
    );
  });
});
