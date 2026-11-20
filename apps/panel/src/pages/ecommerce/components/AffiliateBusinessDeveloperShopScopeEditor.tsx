import { useId, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import {
  TkAlert,
  TkButton,
  TkField,
  TkPanel,
  TkPanelBody,
  TkPrivate,
} from "../../../components/design-system/index.js";
import { formatShopRegionLabel } from "../../../lib/ecommerce-labels.js";
import { shopDisplayLabel, shopSelectSearchTerms } from "../../../lib/shop-display.js";
import {
  SHOP_REGIONS,
  clearShopScopeSelection,
  grantEveryShopScopeRegion,
  groupShopIdsByRegion,
  isGrantableShopRegion,
  isShopScopeDraftSaveable,
  scopeShopsFrom,
  shopScopeRegionState,
  toggleShopScopeRegion,
  toggleShopScopeShop,
  withShopScopeMode,
  type BusinessDeveloperShopScopeDraft,
  type ScopeShopDisplay,
  type ShopScopeMode,
} from "../../../lib/affiliate-bd-shop-scope.js";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import "./AffiliateBusinessDeveloperShopScopeEditor.css";

/** Below this many shops the search box is noise. */
const SEARCH_MIN_SHOPS = 8;

/**
 * Edits which shops a business developer may serve (ADR-110).
 *
 * The first choice is explicit — all shops, or specific regions/shops — because
 * "nothing ticked" used to mean "everything" and was easy to misread. Under
 * "specific", a ticked REGION is a dynamic grant (shops connected later are
 * included) while ticked SHOPS are a static grant; the editor never treats the
 * two as interchangeable.
 *
 * The draft holds primitives only. The shop list is projected out of the entity
 * store during render, so a store refresh can never leave this component
 * holding a dead MST node.
 */
export const AffiliateBusinessDeveloperShopScopeEditor = observer(
  function AffiliateBusinessDeveloperShopScopeEditor({
    value,
    onChange,
    allHint,
    specificHint,
  }: {
    value: BusinessDeveloperShopScopeDraft;
    onChange: (next: BusinessDeveloperShopScopeDraft) => void;
    /**
     * Who the scope belongs to is only named in the two choice hints, so the
     * region admin editor (ADR-112) swaps those and reuses everything else.
     * Both default to the business developer wording.
     */
    allHint?: string;
    specificHint?: string;
  }) {
    const { t } = useTranslation();
    const entityStore = useEntityStore();
    const [search, setSearch] = useState("");
    const modeGroupName = useId();
    const shops = scopeShopsFrom(entityStore.shops);
    const shopById = new Map(shops.map((shop) => [shop.id, shop]));
    const groups = groupShopIdsByRegion(shops);
    const regionsWithoutShops = SHOP_REGIONS.filter(
      (region) => !groups.some((group) => group.region === region),
    );
    const specific = value.shopScopeMode === "SPECIFIC";
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = (shop: ScopeShopDisplay) =>
      !query ||
      shopSelectSearchTerms(shop, shop.id).some((term) =>
        term.toLocaleLowerCase().includes(query),
      );
    const visibleGroups = groups
      .map((group) => ({
        ...group,
        visibleShopIds: group.shopIds.filter((shopId) => matchesSearch(shopById.get(shopId)!)),
      }))
      .filter((group) => !query || group.visibleShopIds.length > 0);
    const selectedEmptyRegionCount = regionsWithoutShops.filter((region) =>
      value.regions.includes(region),
    ).length;

    const modes: Array<{ id: ShopScopeMode; label: string; hint: string }> = [
      {
        id: "ALL",
        label: t("ecommerce.affiliateTeam.shopScopeAll"),
        hint: allHint ?? t("ecommerce.affiliateTeam.shopScopeAllHint"),
      },
      {
        id: "SPECIFIC",
        label: t("ecommerce.affiliateTeam.shopScopeSpecific"),
        hint: specificHint ?? t("ecommerce.affiliateTeam.shopScopeSpecificHint"),
      },
    ];

    return (
      <fieldset className="affiliate-bd-scope">
        <legend>{t("ecommerce.affiliateTeam.shopScopeLabel")}</legend>
        <div
          className="affiliate-bd-scope-modes"
          role="radiogroup"
          aria-label={t("ecommerce.affiliateTeam.shopScopeLabel")}
        >
          {modes.map((mode) => (
            <label className="affiliate-bd-scope-mode" key={mode.id}>
              <input
                type="radio"
                name={modeGroupName}
                checked={value.shopScopeMode === mode.id}
                onChange={() => onChange(withShopScopeMode(value, mode.id))}
              />
              <span>
                <strong>{mode.label}</strong>
                <small>{mode.hint}</small>
              </span>
            </label>
          ))}
        </div>
        {specific && (
          <>
            <div className="affiliate-bd-scope-toolbar">
              {shops.length >= SEARCH_MIN_SHOPS && (
                <TkField
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("common.searchShops")}
                  label={t("common.searchShops")}
                  hideLabel
                />
              )}
              <TkButton
                variant="ghost"
                size="sm"
                disabled={shops.length === 0}
                onClick={() => onChange(grantEveryShopScopeRegion(value, shops))}
              >
                {t("ecommerce.affiliateTeam.shopScopeSelectAllRegions")}
              </TkButton>
              <TkButton
                variant="ghost"
                size="sm"
                disabled={value.regions.length === 0 && value.shopIds.length === 0}
                onClick={() => onChange(clearShopScopeSelection(value))}
              >
                {t("ecommerce.affiliateTeam.shopScopeClear")}
              </TkButton>
            </div>
            {groups.length > 0 && (
              <TkPanel variant="subtle" padding="none">
                <TkPanelBody scroll className="affiliate-bd-scope-list">
                  {visibleGroups.length === 0 && (
                    <small className="form-hint">
                      {t("ecommerce.affiliateTeam.shopScopeNoMatchingShops")}
                    </small>
                  )}
                  {visibleGroups.map((group) => {
                    const state = shopScopeRegionState(value, group.region, group.shopIds);
                    const grantableRegion = isGrantableShopRegion(group.region) ? group.region : null;
                    return (
                      <section
                        className="affiliate-bd-scope-group"
                        key={group.region ?? "__NO_REGION__"}
                      >
                        <header className="affiliate-bd-scope-group-header">
                          <div className="affiliate-bd-scope-group-title">
                            <strong>
                              {group.region
                                ? formatShopRegionLabel(group.region, t)
                                : t("ecommerce.affiliateTeam.shopScopeShopsWithoutRegion")}
                            </strong>
                            <small>
                              {t("ecommerce.affiliateTeam.shopScopeShopCount", {
                                count: group.shopIds.length,
                              })}
                            </small>
                          </div>
                          {grantableRegion && (
                            <label className="affiliate-bd-scope-check affiliate-bd-scope-whole">
                              <input
                                type="checkbox"
                                checked={state.wholeRegion}
                                ref={(element) => {
                                  if (element) element.indeterminate = state.indeterminate;
                                }}
                                onChange={(event) =>
                                  onChange(
                                    toggleShopScopeRegion(
                                      value,
                                      grantableRegion,
                                      event.target.checked,
                                      group.shopIds,
                                    ),
                                  )
                                }
                              />
                              <span>{t("ecommerce.affiliateTeam.shopScopeWholeRegion")}</span>
                            </label>
                          )}
                        </header>
                        {state.wholeRegion && (
                          <small className="affiliate-bd-scope-included">
                            {t("ecommerce.affiliateTeam.shopScopeIncludedInRegion")}
                          </small>
                        )}
                        {state.everyCurrentShopTickedWithoutRegion && grantableRegion && (
                          <TkAlert
                            tone="warning"
                            actions={
                              <TkButton
                                size="sm"
                                onClick={() =>
                                  onChange(
                                    toggleShopScopeRegion(value, grantableRegion, true, group.shopIds),
                                  )
                                }
                              >
                                {t("ecommerce.affiliateTeam.shopScopeGrantWholeRegion")}
                              </TkButton>
                            }
                          >
                            {t("ecommerce.affiliateTeam.shopScopeEveryShopTicked")}
                          </TkAlert>
                        )}
                        <ul className="affiliate-bd-scope-shops">
                          {group.visibleShopIds.map((shopId) => {
                            const shop = shopById.get(shopId)!;
                            const display = shopDisplayLabel(shop, shop.id);
                            return (
                              <li key={shopId}>
                                <label className="affiliate-bd-scope-check">
                                  <input
                                    type="checkbox"
                                    checked={state.wholeRegion || value.shopIds.includes(shopId)}
                                    disabled={state.wholeRegion}
                                    onChange={(event) =>
                                      onChange(
                                        toggleShopScopeShop(value, shopId, event.target.checked),
                                      )
                                    }
                                  />
                                  <TkPrivate sensitive={display.sensitive}>
                                    {display.text}
                                  </TkPrivate>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </TkPanelBody>
              </TkPanel>
            )}
            <details className="affiliate-bd-scope-empty-regions">
              <summary>
                {t("ecommerce.affiliateTeam.shopScopeRegionsWithoutShops")}
                {selectedEmptyRegionCount > 0 && (
                  <small>
                    {t("ecommerce.affiliateTeam.shopScopeRegionsWithoutShopsSelected", {
                      count: selectedEmptyRegionCount,
                    })}
                  </small>
                )}
              </summary>
              <small className="form-hint">
                {t("ecommerce.affiliateTeam.shopScopeRegionsWithoutShopsHint")}
              </small>
              <div className="affiliate-bd-scope-region-grid">
                {regionsWithoutShops.map((region) => (
                  <label className="affiliate-bd-scope-check" key={region}>
                    <input
                      type="checkbox"
                      checked={value.regions.includes(region)}
                      onChange={(event) =>
                        onChange(toggleShopScopeRegion(value, region, event.target.checked, []))
                      }
                    />
                    <span>{formatShopRegionLabel(region, t)}</span>
                  </label>
                ))}
              </div>
            </details>
            {!isShopScopeDraftSaveable(value) && (
              <small className="affiliate-bd-scope-error" role="alert">
                {t("ecommerce.affiliateTeam.shopScopeNothingSelected")}
              </small>
            )}
          </>
        )}
      </fieldset>
    );
  },
);
