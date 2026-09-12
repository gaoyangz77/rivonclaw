import { useTranslation } from "react-i18next";
import { TkBadge, TkChoiceSelect } from "../../../components/design-system/index.js";
import "./CreatorDetailScopeControl.css";

export function CreatorDetailScopeControl({
  value,
  shops,
  onChange,
  disabled,
}: {
  value: string;
  shops: Array<{ id: string; text: string; sensitive: boolean }>;
  onChange: (shopId: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <TkChoiceSelect
      className="affiliate-creator-scope-control"
      label={t("ecommerce.affiliateWorkspace.creatorScope.view")}
      value={value}
      onChange={onChange}
      disabled={disabled}
      options={[
        { value: "", label: t("ecommerce.affiliateWorkspace.creatorScope.globalView") },
        ...shops.map((shop) => ({ value: shop.id, label: shop.text, sensitive: shop.sensitive })),
      ]}
    />
  );
}

export function CreatorGlobalInformation({ profile = false }: { profile?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="affiliate-creator-scope-note">
      <TkBadge>{t("ecommerce.affiliateWorkspace.creatorScope.globalInformation")}</TkBadge>
      <span>
        {t(`ecommerce.affiliateWorkspace.creatorScope.${profile ? "profileHint" : "globalHint"}`)}
      </span>
    </div>
  );
}
