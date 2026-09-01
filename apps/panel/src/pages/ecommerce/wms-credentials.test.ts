import { describe, expect, it } from "vitest";
import {
  wmsCredentialFields,
  wmsCredentialIssue,
  type WmsCredentialDraft,
} from "./wms-credentials.js";

const empty: WmsCredentialDraft = {
  apiKey: "",
  apiSecret: "",
  apiToken: "",
  refreshToken: "",
  providerUserId: "",
  authorizationUser: "",
  authorizationToken: "",
};

describe("wmsCredentialIssue", () => {
  it("models static-token and key/secret providers without JSON", () => {
    expect(wmsCredentialFields("YEJOIN", "EXISTING")).toEqual(["apiToken"]);
    expect(wmsCredentialFields("XLWMS", "EXISTING")).toEqual([
      "apiKey",
      "apiSecret",
    ]);
    expect(
      wmsCredentialIssue(
        "XLWMS",
        "EXISTING",
        { ...empty, apiKey: "key", apiSecret: "secret" },
        false,
      ),
    ).toBeNull();
  });

  it("requires one-time authorization inputs for a new JFWMS account", () => {
    expect(wmsCredentialFields("JFWMS", "AUTHORIZE")).toEqual([
      "apiKey",
      "apiSecret",
      "authorizationUser",
      "authorizationToken",
    ]);
    expect(
      wmsCredentialIssue(
        "JFWMS",
        "AUTHORIZE",
        {
          ...empty,
          apiKey: "id",
          apiSecret: "secret",
          authorizationUser: "merchant@example.com",
          authorizationToken: "once",
        },
        false,
      ),
    ).toBeNull();
  });

  it("also supports importing an existing JFWMS refresh grant", () => {
    expect(wmsCredentialFields("JFWMS", "EXISTING")).toEqual([
      "apiKey",
      "apiSecret",
      "refreshToken",
      "providerUserId",
    ]);
    expect(
      wmsCredentialIssue(
        "JFWMS",
        "EXISTING",
        {
          ...empty,
          apiKey: "id",
          apiSecret: "secret",
          refreshToken: "refresh",
          providerUserId: "8",
        },
        false,
      ),
    ).toBeNull();
  });

  it("allows an edit to retain stored write-only credentials", () => {
    expect(wmsCredentialIssue("JFWMS", "EXISTING", empty, true)).toBeNull();
    expect(wmsCredentialIssue("XLWMS", "EXISTING", empty, true)).toBeNull();
  });

  it("rejects a partial credential replacement", () => {
    expect(
      wmsCredentialIssue(
        "SELLFOX",
        "EXISTING",
        { ...empty, apiKey: "only-key" },
        true,
      ),
    ).toBe("missingFields");
  });
});
