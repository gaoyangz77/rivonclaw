import { useState } from "react";
import { useLazyQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import { useTranslation } from "react-i18next";
import { PRODUCT_KNOWLEDGE_BY_MERCHANT_PID_QUERY } from "../../../api/product-knowledge-queries.js";
import {
  TkButton,
  TkField,
  TkPopover,
  TkPrivate,
} from "../../../components/design-system/index.js";
import "./MerchantPidFilter.css";

export type MerchantPidSelection = Pick<
  GQL.ProductKnowledgeIdentity,
  "id" | "merchantPid" | "name" | "bindingCount"
>;

export function MerchantPidFilter({
  value,
  onChange,
  shopScoped,
}: {
  value: MerchantPidSelection | null;
  onChange: (value: MerchantPidSelection | null) => void;
  shopScoped: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [searched, setSearched] = useState(false);
  const [lookup, { data, loading, error }] = useLazyQuery<{
    productKnowledgeByMerchantPid: GQL.ProductKnowledgeIdentity | null;
  }>(PRODUCT_KNOWLEDGE_BY_MERCHANT_PID_QUERY, { fetchPolicy: "network-only" });
  const result = data?.productKnowledgeByMerchantPid;
  const selectable =
    result?.status === GQL.ProductKnowledgeStatus.Active && result.bindingCount > 0;

  return (
    <TkPopover
      label={t("ecommerce.affiliateWorkspace.workbench.merchantPidFilter")}
      open={open}
      onOpenChange={setOpen}
      className="merchant-pid-filter"
      trigger={(props) => (
        <TkButton {...props}>
          {value ? (
            <TkPrivate>{value.merchantPid}</TkPrivate>
          ) : (
            t("ecommerce.affiliateWorkspace.workbench.merchantPidFilter")
          )}
        </TkButton>
      )}
    >
      <div className="merchant-pid-filter-body">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim() || loading) return;
            setSearched(true);
            void lookup({ variables: { merchantPid: draft.trim() } });
          }}
        >
          <TkField
            label={t("ecommerce.affiliateWorkspace.workbench.merchantPidFilter")}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setSearched(false);
            }}
            type="search"
          />
          <TkButton type="submit" disabled={!draft.trim() || loading}>
            {loading
              ? t("common.loading")
              : t("ecommerce.affiliateWorkspace.workbench.searchCreator")}
          </TkButton>
        </form>
        {value ? (
          <div className="merchant-pid-filter-selected">
            <span>
              <TkPrivate>{value.name}</TkPrivate> · <TkPrivate>{value.merchantPid}</TkPrivate>
            </span>
            <TkButton size="sm" variant="ghost" onClick={() => onChange(null)}>
              {t("ecommerce.affiliateWorkspace.workbench.clearProducts")}
            </TkButton>
          </div>
        ) : null}
        {searched && error ? (
          <p role="alert">{t("ecommerce.affiliateWorkspace.workbench.merchantPidLoadFailed")}</p>
        ) : null}
        {searched && !loading && !error && !result ? (
          <p role="status">{t("ecommerce.affiliateWorkspace.workbench.merchantPidNotFound")}</p>
        ) : null}
        {searched && !loading && result ? (
          <div className="merchant-pid-filter-result">
            <strong>
              <TkPrivate>{result.name}</TkPrivate>
            </strong>
            <span>
              <TkPrivate>{result.merchantPid}</TkPrivate> ·{" "}
              {t("ecommerce.affiliateWorkspace.workbench.merchantPidBindings", {
                count: result.bindingCount,
              })}
            </span>
            {result.status === GQL.ProductKnowledgeStatus.Archived ? (
              <p role="status">{t("ecommerce.affiliateWorkspace.workbench.merchantPidArchived")}</p>
            ) : result.bindingCount === 0 ? (
              <p role="status">{t("ecommerce.affiliateWorkspace.workbench.merchantPidUnbound")}</p>
            ) : null}
            <TkButton
              size="sm"
              variant="secondary"
              disabled={!selectable}
              onClick={() => {
                onChange({
                  id: result.id,
                  merchantPid: result.merchantPid,
                  name: result.name,
                  bindingCount: result.bindingCount,
                });
                setOpen(false);
              }}
            >
              {t("ecommerce.affiliateWorkspace.workbench.merchantPidSelect")}
            </TkButton>
          </div>
        ) : null}
        {shopScoped ? (
          <p className="merchant-pid-filter-scope">
            {t("ecommerce.affiliateWorkspace.workbench.merchantPidShopScope")}
          </p>
        ) : null}
      </div>
    </TkPopover>
  );
}
