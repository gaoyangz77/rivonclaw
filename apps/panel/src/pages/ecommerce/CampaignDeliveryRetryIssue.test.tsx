import { createInstance } from "i18next";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AFFILIATE_CAMPAIGN_TRANSLATIONS } from "../../i18n/affiliate-campaign-translations.js";
import { CampaignDeliveryRetryIssue } from "./AffiliateCampaignPage.js";

afterEach(cleanup);

const SENSITIVE =
  "TikTok API error 50001703: Operation Not Allowed. Cannot perform this operation: the request parameters contain sensitive words. Please remove sensitive words from request parameters before retrying.";

describe("Campaign failing-delivery retry banner", () => {
  it("shows the Provider's reason and how many scheduled Creators it holds back", async () => {
    const i18n = createInstance();
    await i18n.init({
      lng: "zh",
      resources: { zh: { translation: AFFILIATE_CAMPAIGN_TRANSLATIONS.zh } },
    });
    render(
      <CampaignDeliveryRetryIssue
        reasons={[
          {
            reason: SENSITIVE,
            count: 107,
            lastFailedAt: "2026-11-26T16:40:49.620Z",
            nextRetryAt: "2026-11-26T16:45:47.233Z",
          },
        ]}
        t={i18n.t}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("定向邀请发送失败，正在自动重试");
    expect(screen.getByText(/107 位已安排的达人最近一次发送失败/)).toBeTruthy();
    expect(screen.getByText(SENSITIVE)).toBeTruthy();
    expect(screen.getByText("平台返回的原因")).toBeTruthy();
  });
});
