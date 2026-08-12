// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { GQL } from "@rivonclaw/core";
import { describe, expect, it, vi } from "vitest";
import {
  DeveloperEditor,
  PROTECTED_CREATOR_TEMPLATE_HEADERS,
  SHOP_REGIONS,
  developerFormFrom,
  isDeveloperFormDirty,
  writeDeveloperInputFrom,
} from "./AffiliateTeamPage.js";

describe("Affiliate business developer region editor", () => {
  const developer = {
    displayName: "Regional BD",
    creatorDisplayName: "Creator-facing BD",
    regions: [GQL.ShopRegion.Us],
    acceptingCreators: true,
    agentAssistanceMode: GQL.AffiliateAgentAssistanceMode.AiAssisted,
    businessPrompt: "Keep it warm.",
  };

  it("round-trips the optional Creator-facing name through draft and mutation input", () => {
    const form = developerFormFrom(developer);
    expect(isDeveloperFormDirty(form, developer)).toBe(false);
    expect(isDeveloperFormDirty({ ...form, creatorDisplayName: "Mia" }, developer)).toBe(true);
    expect(writeDeveloperInputFrom(form, "bd-1")).toMatchObject({
      id: "bd-1",
      displayName: "Regional BD",
      creatorDisplayName: "Creator-facing BD",
    });
    expect(writeDeveloperInputFrom({ ...form, creatorDisplayName: "  " })).toMatchObject({
      creatorDisplayName: null,
    });
  });

  it("renders only supported shop regions and has no other-region option", () => {
    const t = ((key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? key)) as never;
    render(
      <DeveloperEditor
        form={{
          displayName: "Regional BD",
          creatorDisplayName: "Creator-facing BD",
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
    expect(screen.getByDisplayValue("Regional BD")).toBeTruthy();
    expect(screen.getByDisplayValue("Creator-facing BD")).toBeTruthy();
  });
});

describe("Affiliate protected creator import template", () => {
  it("only exposes creator username and optional BD display name", () => {
    expect(PROTECTED_CREATOR_TEMPLATE_HEADERS).toEqual([
      "creator_username",
      "bd_name",
    ]);
    expect(PROTECTED_CREATOR_TEMPLATE_HEADERS).not.toContain("platform");
    expect(PROTECTED_CREATOR_TEMPLATE_HEADERS).not.toContain("creator_open_id");
  });
});
