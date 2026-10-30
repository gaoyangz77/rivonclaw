import { useState } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { AffiliateCreatorFilterGroups } from "./AffiliateCreatorFilterGroups.js";

beforeEach(async () => { await i18n.changeLanguage("zh"); });
afterEach(cleanup);

function Harness() {
  const [global, setGlobal] = useState<GQL.CreatorSampleTier[]>([]);
  const [shop, setShop] = useState<GQL.CreatorSampleTier[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  return <AffiliateCreatorFilterGroups manualTagCatalog={[{ id: "a", name: "标签甲" }, { id: "b", name: "标签乙" }]}
    manualTagMatchMode={GQL.TagMatchMode.Any} systemTagDefinitions={[]}
    systemTagMatchMode={GQL.TagMatchMode.Any} selectedManualTagIds={tags} selectedSystemTags={[]}
    needsAttentionOnly={false} includeCreatorsWithoutUsername={false} selectedSampleTiers={global} selectedShopSampleTiers={shop}
    shopSelected onManualTagMatchModeChange={() => {}} onSystemTagMatchModeChange={() => {}}
    onNeedsAttentionOnlyChange={() => {}} onIncludeCreatorsWithoutUsernameChange={() => {}} onSelectedManualTagIdsChange={setTags}
    onSelectedSystemTagsChange={() => {}} onSelectedSampleTiersChange={setGlobal}
    onSelectedShopSampleTiersChange={setShop} />;
}

it.each([0, 1])("switches and clears progress selection in group %s without affecting manual multi-select", group => {
  render(<Harness />);
  const shipped = screen.getAllByRole("button", { name: /已发样/ })[group];
  const received = screen.getAllByRole("button", { name: /已收样/ })[group];
  fireEvent.click(shipped);
  expect(shipped.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(received);
  expect(shipped.getAttribute("aria-pressed")).toBe("false");
  expect(received.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(received);
  expect(received.getAttribute("aria-pressed")).toBe("false");
  for (const name of ["标签甲", "标签乙"]) fireEvent.click(screen.getByRole("button", { name }));
  for (const name of ["标签甲", "标签乙"]) expect(screen.getByRole("button", { name }).getAttribute("aria-pressed")).toBe("true");
});

it("toggles including Creators that TikTok gave no username", () => {
  const changes: boolean[] = [];
  render(<AffiliateCreatorFilterGroups manualTagCatalog={[]} manualTagMatchMode={GQL.TagMatchMode.Any}
    systemTagDefinitions={[]} systemTagMatchMode={GQL.TagMatchMode.Any} selectedManualTagIds={[]}
    selectedSystemTags={[]} needsAttentionOnly={false} includeCreatorsWithoutUsername={false}
    selectedSampleTiers={[]} selectedShopSampleTiers={[]} shopSelected={false}
    onManualTagMatchModeChange={() => {}} onSystemTagMatchModeChange={() => {}}
    onNeedsAttentionOnlyChange={() => {}} onIncludeCreatorsWithoutUsernameChange={(value) => changes.push(value)}
    onSelectedManualTagIdsChange={() => {}} onSelectedSystemTagsChange={() => {}}
    onSelectedSampleTiersChange={() => {}} onSelectedShopSampleTiersChange={() => {}} />);
  const toggle = screen.getByRole("checkbox", { name: "显示无账号名达人" });
  expect((toggle as HTMLInputElement).checked).toBe(false);
  fireEvent.click(toggle);
  expect(changes).toEqual([true]);
});
