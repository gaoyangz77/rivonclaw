import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { Select } from "../../../components/inputs/Select.js";
import { CREATOR_SAMPLE_TIER_ORDER, creatorSampleTierLabel } from "../affiliate-creator-tiers.js";
import { creatorSystemTagLabel } from "../affiliate-creator-system-tags.js";
import { AffiliateChipMultiSelect } from "./AffiliateChipMultiSelect.js";

/**
 * Relationship-level creator filters.
 *
 * Tier filtering is exact-match: selecting 已发样 returns creators *currently
 * stopped at* 已发样, never every creator that ever shipped a sample. That is
 * why the group is labelled 当前进度 rather than 标签, and why it must be
 * multi-select — several rungs are expressed by selecting several.
 *
 * Order is layout-bearing: both progress groups hold the same fixed four
 * chips, so they sit adjacent and take only the width those chips need, the
 * open-ended manual tag group absorbs the remainder, and the needs-attention
 * switch closes the row flush against the panel edge.
 *
 * The switch lives here rather than beside the search box because it is a
 * condition, not a lookup: it narrows the same result set the chips narrow,
 * while the search box answers "which creator is this".
 *
 * Every group's explanation rides on its label tooltip. A visible hint line
 * exists in only some groups, and it silently shifts that group's chips down
 * one line, which is what broke the row's shared baseline before.
 */
export function AffiliateCreatorFilterGroups({
  manualTagCatalog,
  manualTagMatchMode,
  systemTagDefinitions,
  systemTagMatchMode,
  selectedManualTagIds,
  selectedSystemTags,
  needsAttentionOnly,
  selectedSampleTiers,
  selectedShopSampleTiers,
  shopSelected,
  onManualTagMatchModeChange,
  onSystemTagMatchModeChange,
  onNeedsAttentionOnlyChange,
  onSelectedManualTagIdsChange,
  onSelectedSystemTagsChange,
  onSelectedSampleTiersChange,
  onSelectedShopSampleTiersChange,
}: {
  manualTagCatalog: ReadonlyArray<Pick<GQL.CreatorManualTag, "id" | "name">>;
  manualTagMatchMode: GQL.TagMatchMode;
  systemTagDefinitions: ReadonlyArray<Pick<GQL.AffiliateCreatorSystemTagDefinition, "tag">>;
  systemTagMatchMode: GQL.TagMatchMode;
  needsAttentionOnly: boolean;
  selectedManualTagIds: string[];
  selectedSystemTags: GQL.AffiliateCreatorSystemTag[];
  selectedSampleTiers: GQL.CreatorSampleTier[];
  selectedShopSampleTiers: GQL.CreatorSampleTier[];
  shopSelected: boolean;
  onManualTagMatchModeChange: (mode: GQL.TagMatchMode) => void;
  onSystemTagMatchModeChange: (mode: GQL.TagMatchMode) => void;
  onNeedsAttentionOnlyChange: (needsAttentionOnly: boolean) => void;
  onSelectedManualTagIdsChange: (tagIds: string[]) => void;
  onSelectedSystemTagsChange: (tags: GQL.AffiliateCreatorSystemTag[]) => void;
  onSelectedSampleTiersChange: (tiers: GQL.CreatorSampleTier[]) => void;
  onSelectedShopSampleTiersChange: (tiers: GQL.CreatorSampleTier[]) => void;
}) {
  const { t } = useTranslation();
  const tierOptions = CREATOR_SAMPLE_TIER_ORDER.map((tier) => ({
    id: tier,
    label: creatorSampleTierLabel(t, tier),
  }));
  const manualTagOptions = manualTagCatalog.map((tag) => ({ id: tag.id, label: tag.name }));
  const systemTagOptions = systemTagDefinitions.map((definition) => ({
    id: definition.tag,
    label: creatorSystemTagLabel(t, definition.tag),
  }));

  return (
    <div
      className={
        shopSelected
          ? "affiliate-creator-filter-groups affiliate-creator-filter-groups-with-shop-tier"
          : "affiliate-creator-filter-groups"
      }
      data-tutorial-id="affiliate-creators-filters"
    >
      <AffiliateChipMultiSelect
        label={t("ecommerce.affiliateWorkspace.sampleTierFilterLabel")}
        labelTitle={t("ecommerce.affiliateWorkspace.sampleTierFilterHint")}
        options={tierOptions}
        selectedIds={selectedSampleTiers}
        onChange={onSelectedSampleTiersChange}
      />

      {shopSelected ? (
        <AffiliateChipMultiSelect
          label={t("ecommerce.affiliateWorkspace.shopSampleTierFilterLabel")}
          labelTitle={t("ecommerce.affiliateWorkspace.shopSampleTierFilterHint")}
          options={tierOptions}
          selectedIds={selectedShopSampleTiers}
          onChange={onSelectedShopSampleTiersChange}
        />
      ) : null}

      <div className="affiliate-creator-filter-group">
        <AffiliateChipMultiSelect
          label={t("ecommerce.affiliateWorkspace.systemTagFilterLabel")}
          labelTitle={t("ecommerce.affiliateWorkspace.systemTags.hint")}
          options={systemTagOptions}
          selectedIds={selectedSystemTags}
          onChange={(tags) => onSelectedSystemTagsChange(tags as GQL.AffiliateCreatorSystemTag[])}
        />
        {selectedSystemTags.length > 1 ? (
          <label className="affiliate-filter-field affiliate-creator-filter-match-mode">
            <span>{t("ecommerce.affiliateWorkspace.systemTagMatchModeLabel")}</span>
            <Select
              value={systemTagMatchMode}
              onChange={(value) => onSystemTagMatchModeChange(value as GQL.TagMatchMode)}
              options={[
                {
                  value: GQL.TagMatchMode.Any,
                  label: t("ecommerce.affiliateWorkspace.manualTagMatchModes.ANY"),
                },
                {
                  value: GQL.TagMatchMode.All,
                  label: t("ecommerce.affiliateWorkspace.manualTagMatchModes.ALL"),
                },
              ]}
              className="affiliate-status-select"
              ariaLabel={t("ecommerce.affiliateWorkspace.systemTagMatchModeLabel")}
            />
          </label>
        ) : null}
      </div>

      <div className="affiliate-creator-filter-group">
        <AffiliateChipMultiSelect
          label={t("ecommerce.affiliateWorkspace.manualTagFilterLabel")}
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
                {
                  value: GQL.TagMatchMode.Any,
                  label: t("ecommerce.affiliateWorkspace.manualTagMatchModes.ANY"),
                },
                {
                  value: GQL.TagMatchMode.All,
                  label: t("ecommerce.affiliateWorkspace.manualTagMatchModes.ALL"),
                },
              ]}
              className="affiliate-status-select"
              ariaLabel={t("ecommerce.affiliateWorkspace.manualTagMatchModeLabel")}
            />
          </label>
        ) : null}
      </div>

      <label className="affiliate-creators-toggle">
        <input
          type="checkbox"
          checked={needsAttentionOnly}
          onChange={(event) => onNeedsAttentionOnlyChange(event.target.checked)}
        />
        <span>{t("ecommerce.affiliateWorkspace.creatorAttentionOnly")}</span>
      </label>
    </div>
  );
}
