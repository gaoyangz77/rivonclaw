// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GQL } from "@rivonclaw/core";
import { describe, expect, it, vi, afterEach } from "vitest";
import i18n from "../../i18n/index.js";
import {
  DeveloperEditor,
  DeveloperIntakeLimits,
  validDeveloperIntake,
  CREATOR_BULK_UPDATE_TEMPLATE_HEADERS,
  SHOP_REGIONS,
  developerFormFrom,
  isDeveloperFormDirty,
  writeDeveloperInputFrom,
} from "./AffiliateTeamPage.js";

afterEach(cleanup);

describe("optional automatic Creator intake limits", () => {
  function source() {
    return { displayName: "BD", regions: [], acceptingCreators: true, agentAssistanceMode: GQL.AffiliateAgentAssistanceMode.AiAssisted };
  }
  it("defaults legacy profiles to unlimited with 100/500 editable limits", () => {
    const form = developerFormFrom(source());
    expect(form).toMatchObject({ creatorIntakeLimitsEnabled: false, weeklyCreatorLimit: 100, monthlyCreatorLimit: 500 });
    expect(isDeveloperFormDirty(form, source())).toBe(false);
    const changed = { ...form, creatorIntakeLimitsEnabled: true, weeklyCreatorLimit: 25, monthlyCreatorLimit: 90 };
    expect(isDeveloperFormDirty(changed, source())).toBe(true);
    expect(writeDeveloperInputFrom(changed)).toMatchObject({ creatorIntakeLimitsEnabled: true, weeklyCreatorLimit: 25, monthlyCreatorLimit: 90 });
    expect(isDeveloperFormDirty(developerFormFrom(changed), changed)).toBe(false);
  });
  it("conditionally exposes labelled limits and explains the UTC+8 reset boundaries", async () => {
    await i18n.changeLanguage("zh");
    const form = developerFormFrom(source());
    const setForm = vi.fn();
    const instance = render(<DeveloperIntakeLimits form={form} setForm={setForm} />);
    expect(screen.queryByRole("spinbutton")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "限制自动接收数量" }));
    expect(setForm).toHaveBeenCalledWith({ ...form, creatorIntakeLimitsEnabled: true });
    const enabled = { ...form, creatorIntakeLimitsEnabled: true };
    instance.rerender(<DeveloperIntakeLimits form={enabled} setForm={setForm} />);
    expect(screen.getByRole("spinbutton", { name: "每周上限" })).toHaveProperty("value", "100");
    expect(screen.getByRole("spinbutton", { name: "每月上限" })).toHaveProperty("value", "500");
    expect(screen.getByText(/UTC\+8/)).toBeTruthy();
    fireEvent.change(screen.getByRole("spinbutton", { name: "每周上限" }), { target: { value: "8" } });
    expect(setForm).toHaveBeenCalledWith({ ...enabled, weeklyCreatorLimit: 8 });
    expect(validDeveloperIntake({ ...enabled, weeklyCreatorLimit: 0 })).toBe(false);
    expect(validDeveloperIntake({ ...enabled, monthlyCreatorLimit: 2.5 })).toBe(false);
    expect(validDeveloperIntake({ ...enabled, creatorIntakeLimitsEnabled: false, weeklyCreatorLimit: 0 })).toBe(true);
  });
  it.each(["en", "zh", "de", "es", "fr", "id", "it", "th"])("has intake copy in %s", language => {
    for (const key of ["intakeAdvanced", "intakeLimitsEnabled", "weeklyCreatorLimit", "monthlyCreatorLimit", "creatorIntakeLimitsHint", "creatorIntakeLimitInvalid"]) {
      expect(i18n.exists(`ecommerce.affiliateTeam.${key}`, { lng: language })).toBe(true);
    }
  });
});

describe("Affiliate business developer region editor", () => {
  const developer = {
    displayName: "Regional BD",
    creatorDisplayName: "Creator-facing BD",
    regions: [GQL.ShopRegion.Us],
    acceptingCreators: true,
    agentAssistanceMode: GQL.AffiliateAgentAssistanceMode.AiAssisted,
    businessPrompt: "Keep it warm.",
    deviceId: "device-1",
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

  it("round-trips the outreach device draft and stores blank as unbound", () => {
    const form = developerFormFrom(developer);
    expect(form.deviceId).toBe("device-1");
    expect(isDeveloperFormDirty({ ...form, deviceId: "device-2" }, developer)).toBe(true);
    expect(isDeveloperFormDirty({ ...form, deviceId: "" }, developer)).toBe(true);
    expect(writeDeveloperInputFrom(form, "bd-1")).toMatchObject({ deviceId: "device-1" });
    expect(writeDeveloperInputFrom({ ...form, deviceId: "  " })).toMatchObject({ deviceId: null });
    const legacyForm = developerFormFrom({ ...developer, deviceId: null });
    expect(legacyForm.deviceId).toBe("");
    expect(isDeveloperFormDirty(legacyForm, { ...developer, deviceId: null })).toBe(false);
  });

  it("uses the saved mutation response as a stable dirty-state baseline", () => {
    const staleWorkspaceDeveloper = developer;
    const savedDeveloper = {
      ...developer,
      businessPrompt: "Move accepted collaborations to WhatsApp.",
    };
    const savedForm = developerFormFrom(savedDeveloper);

    expect(isDeveloperFormDirty(savedForm, staleWorkspaceDeveloper)).toBe(true);
    expect(isDeveloperFormDirty(savedForm, savedForm)).toBe(false);
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
          creatorIntakeLimitsEnabled: false,
          weeklyCreatorLimit: 100,
          monthlyCreatorLimit: 500,
          agentAssistanceMode: GQL.AffiliateAgentAssistanceMode.AiAssisted,
          businessPrompt: "",
          deviceId: "",
          escalationChannelId: "",
          escalationRecipientId: "",
        }}
        setForm={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        saving={false}
        myDeviceId="device-1"
        t={t}
      />,
    );

    expect(SHOP_REGIONS).toEqual(Object.values(GQL.ShopRegion));
    expect(SHOP_REGIONS).not.toContain("ROW");
    // Region checkboxes + acceptingCreators toggle + outreach-device toggle.
    expect(screen.getAllByRole("checkbox")).toHaveLength(SHOP_REGIONS.length + 3);
    expect(screen.getByDisplayValue("Regional BD")).toBeTruthy();
    expect(screen.getByDisplayValue("Creator-facing BD")).toBeTruthy();
  });
});

describe("Affiliate business developer detail from creators", () => {
  it("reuses the existing detail modal in place without changing routes", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateTeamPage.tsx"),
      "utf8",
    );
    const creatorsSource = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );

    expect(creatorsSource).toContain("<AffiliateTeamPage");
    expect(creatorsSource).toContain(
      "detailOnlyDeveloper={businessDeveloperById.get(detailBusinessDeveloperId)!}",
    );
    expect(creatorsSource).toContain("onDetailClose={() => setDetailBusinessDeveloperId(null)}");
    expect(creatorsSource).not.toContain('params.set("developerId"');
    expect(source).toContain(
      "if (!detailOnlyDeveloper || detailSummary || developerPageQuery.loading) return;",
    );
    expect(source).toContain("openDeveloperDetail(summary)");
    expect(source).toContain('className="affiliate-bd-detail-modal"');
  });
});

describe("Affiliate Creator bulk update template", () => {
  it("keeps the existing column names for row-scoped overrides", () => {
    expect(CREATOR_BULK_UPDATE_TEMPLATE_HEADERS).toEqual([
      "creator_username",
      "creator_uid_note",
      "creator_note",
      "bd_name",
      "protection_action",
      "protection_note",
      "add_manual_tag_1",
      "add_manual_tag_2",
      "add_manual_tag_3",
      "add_manual_tag_4",
      "add_manual_tag_5",
    ]);
    expect(CREATOR_BULK_UPDATE_TEMPLATE_HEADERS).not.toContain("platform");
    expect(CREATOR_BULK_UPDATE_TEMPLATE_HEADERS).not.toContain("creator_open_id");
  });
});
