import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { Select } from "../../../components/inputs/Select.js";
import { CREATOR_SAMPLE_TIER_ORDER, creatorSampleTierLabel } from "../affiliate-creator-tiers.js";
import { AffiliateChipMultiSelect } from "./AffiliateChipMultiSelect.js";

/**
 * Relationship-level creator filters.
 *
 * Tier filtering is exact-match: selecting 已发样 returns creators *currently
 * stopped at* 已发样, never every creator that ever shipped a sample. That is
 * why the group is labelled 当前进度 rather than 标签, and why it must be
 * multi-select — several rungs are expressed by selecting several.
 */
export function AffiliateCreatorFilterGroups({
  manualTagCatalog,
  manualTagMatchMode,
  selectedManualTagIds,
  selectedSampleTiers,
  selectedShopSampleTiers,
  shopSelected,
  onManualTagMatchModeChange,
  onSelectedManualTagIdsChange,
  onSelectedSampleTiersChange,
  onSelectedShopSampleTiersChange,
}: {
  manualTagCatalog: ReadonlyArray<Pick<GQL.CreatorManualTag, "id" | "name">>;
  manualTagMatchMode: GQL.TagMatchMode;
  selectedManualTagIds: string[];
  selectedSampleTiers: GQL.CreatorSampleTier[];
  selectedShopSampleTiers: GQL.CreatorSampleTier[];
  shopSelected: boolean;
  onManualTagMatchModeChange: (mode: GQL.TagMatchMode) => void;
  onSelectedManualTagIdsChange: (tagIds: string[]) => void;
  onSelectedSampleTiersChange: (tiers: GQL.CreatorSampleTier[]) => void;
  onSelectedShopSampleTiersChange: (tiers: GQL.CreatorSampleTier[]) => void;
}) {
  const { t } = useTranslation();
  const tierOptions = CREATOR_SAMPLE_TIER_ORDER.map((tier) => ({
    id: tier,
    label: creatorSampleTierLabel(t, tier),
  }));
  const manualTagOptions = manualTagCatalog.map((tag) => ({ id: tag.id, label: tag.name }));

  return (
    <div className="affiliate-creator-filter-groups" data-tutorial-id="affiliate-creators-filters">
      <AffiliateChipMultiSelect
        label={t("ecommerce.affiliateWorkspace.sampleTierFilterLabel")}
        hint={t("ecommerce.affiliateWorkspace.sampleTierFilterHint")}
        emptyLabel={t("ecommerce.affiliateWorkspace.allSampleTiersFilter")}
        options={tierOptions}
        selectedIds={selectedSampleTiers}
        onChange={onSelectedSampleTiersChange}
      />

      <div className="affiliate-creator-filter-group">
        <AffiliateChipMultiSelect
          label={t("ecommerce.affiliateWorkspace.manualTagFilterLabel")}
          emptyLabel={t("ecommerce.affiliateWorkspace.allManualTagsFilter")}
          options={manualTagOptions}
          selectedIds={selectedManualTagIds}
          onChange={onSelectedManualTagIdsChange}
        />
        {selectedManualTagIds.length > 1 ? (
          <label className="affiliate-filter-field affiliate-creator-filter-match-mode">
            <span>{t("ecommerce.affiliateWorkspace.manualTagMatchModeLabel")}</span>
            <Select
              value={manualTagMatchMode}
              onChange={(value) => onManualTagMatchModeChange(value as GQL.TagMatchMode)}
              options={[
                { value: GQL.TagMatchMode.Any, label: t("ecommerce.affiliateWorkspace.manualTagMatchModes.ANY") },
                { value: GQL.TagMatchMode.All, label: t("ecommerce.affiliateWorkspace.manualTagMatchModes.ALL") },
              ]}
              className="affiliate-status-select"
              ariaLabel={t("ecommerce.affiliateWorkspace.manualTagMatchModeLabel")}
            />
          </label>
        ) : null}
      </div>

      {shopSelected ? (
        <AffiliateChipMultiSelect
          label={t("ecommerce.affiliateWorkspace.shopSampleTierFilterLabel")}
          hint={t("ecommerce.affiliateWorkspace.shopSampleTierFilterHint")}
          emptyLabel={t("ecommerce.affiliateWorkspace.allSampleTiersFilter")}
          options={tierOptions}
          selectedIds={selectedShopSampleTiers}
          onChange={onSelectedShopSampleTiersChange}
        />
      ) : null}
    </div>
  );
}
