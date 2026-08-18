import { describe, expect, it } from "vitest";
import { wmsApiTokenFields, wmsApiTokenIssue } from "./wms-credentials.js";

describe("wmsApiTokenIssue", () => {
  it("accepts an opaque token for a provider without a JSON contract", () => {
    expect(wmsApiTokenIssue("YEJOIN", "1f2e3d4c5b6a7988")).toBeNull();
    expect(wmsApiTokenFields("YEJOIN")).toBeNull();
  });

  it("accepts a well-formed credential object", () => {
    expect(wmsApiTokenIssue("XLWMS", '{"appKey":"key","appSecret":"secret"}')).toBeNull();
    expect(wmsApiTokenIssue("LINGXING", '{"appId":"id","appSecret":"secret"}')).toBeNull();
  });

  it("rejects the plain string that broke the nightly inventory sync", () => {
    expect(wmsApiTokenIssue("XLWMS", "9f8e7d6c5b4a39281706f5e4d3c2b1a0")).toBe("invalidJson");
  });

  it("rejects JSON that is not a credential object", () => {
    expect(wmsApiTokenIssue("XLWMS", '["key","secret"]')).toBe("invalidJson");
    expect(wmsApiTokenIssue("XLWMS", '"token"')).toBe("invalidJson");
  });

  it("rejects an object missing or blanking a required field", () => {
    expect(wmsApiTokenIssue("XLWMS", '{"appKey":"key"}')).toBe("missingFields");
    expect(wmsApiTokenIssue("XLWMS", '{"appKey":"key","appSecret":"  "}')).toBe("missingFields");
    expect(wmsApiTokenIssue("LINGXING", '{"appKey":"key","appSecret":"secret"}')).toBe(
      "missingFields",
    );
  });

  it("treats an empty field as no issue, so editing can keep the stored token", () => {
    expect(wmsApiTokenIssue("XLWMS", "")).toBeNull();
    expect(wmsApiTokenIssue("XLWMS", "   ")).toBeNull();
  });

  it("tolerates whitespace around a pasted credential", () => {
    expect(wmsApiTokenIssue("XLWMS", '  {"appKey":"key","appSecret":"secret"}\n')).toBeNull();
  });
});
