import { SUBSCRIPTION_PROVIDER_IDS, API_PROVIDER_IDS, getProviderMeta } from "@rivonclaw/core";
import type { LLMProvider } from "@rivonclaw/core";
import { ProviderSelect } from "./inputs/ProviderSelect.js";
import { PricingTable, SubscriptionPricingTable } from "./PricingTable.js";
import { useProviderForm } from "./provider-setup/use-provider-form.js";
import { LocalModelForm } from "./provider-setup/LocalModelForm.js";
import { ApiKeyForm } from "./provider-setup/ApiKeyForm.js";
import { OAuthProviderForm } from "./provider-setup/OAuthProviderForm.js";
import { CustomProviderForm } from "./provider-setup/CustomProviderForm.js";
import { TkAlert, TkPanel, TkTabs } from "./design-system/index.js";


export interface ProviderSetupFormProps {
  /** Called after a provider key is successfully saved. */
  onSave: (provider: string) => void;
  /** Form card title. */
  title?: string;
  /** Description below the title. */
  description?: string;
  /** Primary save button label (defaults to t("common.save")). */
  saveButtonLabel?: string;
  /** Validating state label (defaults to t("providers.validating")). */
  validatingLabel?: string;
  /** Saving state label (defaults to "..."). */
  savingLabel?: string;
  /** "card" (default): section-card with h3. "page": no card, h1 heading for standalone pages like onboarding. */
  variant?: "card" | "page";
}

export function ProviderSetupForm({
  onSave,
  title,
  description,
  saveButtonLabel,
  validatingLabel,
  savingLabel,
  variant = "card",
}: ProviderSetupFormProps) {
  const form = useProviderForm(onSave);
  const { t, tab, handleTabChange, provider, handleProviderChange, error, leftCardRef, leftHeight, pricingList, pricingLoading } = form;

  const providerFilter = tab === "subscription" ? SUBSCRIPTION_PROVIDER_IDS : API_PROVIDER_IDS;
  const isOAuth = !!getProviderMeta(provider as LLMProvider)?.oauth;

  return (
    <div className="page-two-col" data-tutorial-id="providers-setup">
      <TkPanel
        innerRef={leftCardRef}
        variant={variant === "card" ? "framed" : "open"}
        className={variant === "card" ? "section-card page-col-main" : "flex-1"}
      >
        {title && (variant === "card" ? <h3>{title}</h3> : <h1>{title}</h1>)}
        {description && <p>{description}</p>}

        {error && (
          <TkAlert tone="danger" title={t(error.key)}>
            {error.detail}
            {error.hover && <details className="error-details"><summary>{t("providers.errorDetails")}</summary><code>{error.hover}</code></details>}
          </TkAlert>
        )}

        <TkTabs
          items={[
            { id: "subscription", label: t("providers.tabSubscription") },
            { id: "api", label: t("providers.tabApi") },
            { id: "local", label: t("providers.tabLocal") },
            { id: "custom", label: t("providers.tabCustom") },
          ]}
          value={tab}
          onChange={(value) => handleTabChange(value as typeof tab)}
          label={t("providers.title")}
          data-tutorial-id="providers-tabs"
        />

        {tab === "custom" ? (
          <CustomProviderForm form={form} saveButtonLabel={saveButtonLabel} validatingLabel={validatingLabel} savingLabel={savingLabel} />
        ) : tab === "local" ? (
          <LocalModelForm form={form} saveButtonLabel={saveButtonLabel} savingLabel={savingLabel} />
        ) : (
          <>
            <div className="mb-sm" data-tutorial-id="providers-selector">
              <div className="form-label text-secondary">{t("onboarding.providerLabel")}</div>
              <ProviderSelect value={provider} onChange={handleProviderChange} providers={providerFilter} />
            </div>

            {isOAuth ? (
              <OAuthProviderForm form={form} saveButtonLabel={saveButtonLabel} validatingLabel={validatingLabel} savingLabel={savingLabel} />
            ) : (
              <ApiKeyForm form={form} saveButtonLabel={saveButtonLabel} validatingLabel={validatingLabel} savingLabel={savingLabel} />
            )}
          </>
        )}
      </TkPanel>

      {/* Right: Pricing table / Local info / Custom info */}
      <div className="page-col-side" style={{ height: leftHeight }} data-tutorial-id="providers-info">
        {tab === "custom" ? (
          <TkPanel className="section-card pricing-card provider-info-card">
            <h4 className="pricing-heading">{t("providers.customInfoTitle")}</h4>
            <div className="provider-info-body">
              {t("providers.customInfoBody")}
            </div>
          </TkPanel>
        ) : tab === "local" ? (
          <TkPanel className="section-card pricing-card provider-info-card">
            <h4 className="pricing-heading">{t("providers.localInfoTitle")}</h4>
            <div className="provider-info-body">
              {t("providers.localInfoBody")}
            </div>
          </TkPanel>
        ) : tab === "subscription" ? (
          <SubscriptionPricingTable provider={provider} pricingList={pricingList} loading={pricingLoading} />
        ) : (
          <PricingTable provider={provider} pricingList={pricingList} loading={pricingLoading} />
        )}
      </div>
    </div>
  );
}
