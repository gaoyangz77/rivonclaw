// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { GQL } from "@rivonclaw/core";
import { describe, expect, it, vi } from "vitest";
import { DeveloperEditor, SHOP_REGIONS } from "./AffiliateTeamPage.js";

describe("Affiliate business developer region editor", () => {
  it("renders only supported shop regions and has no other-region option", () => {
    const t = ((key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? key)) as never;
    render(
      <DeveloperEditor
        form={{
          displayName: "Regional BD",
          regions: [],
          acceptingCreators: true,
          agentAssistanceMode: GQL.AffiliateAgentAssistanceMode.AiAssisted,
          businessPrompt: "",
        }}
        setForm={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        saving={false}
        t={t}
      />,
    );

    expect(SHOP_REGIONS).toEqual(Object.values(GQL.ShopRegion));
    expect(SHOP_REGIONS).not.toContain("ROW");
    expect(screen.getAllByRole("checkbox")).toHaveLength(SHOP_REGIONS.length + 1);
  });
});
