import { TagInput } from "../TagInput.js";
import { Select } from "../Select.js";
import { ModalityCheckboxGroup } from "./ModalityCheckboxGroup.js";
import type { ProviderFormState } from "./use-provider-form.js";

export function CustomProviderForm({
  form,
  saveButtonLabel,
  validatingLabel,
  savingLabel,
}: {
  form: ProviderFormState;
  saveButtonLabel?: string;
  validatingLabel?: string;
  savingLabel?: string;
}) {
  const {
    t,
    customName, setCustomName,
    customProtocol, setCustomProtocol,
    customEndpoint, setCustomEndpoint,
    apiKey, setApiKey,
    customModels, setCustomModels,
    inputModalities, setInputModalities,
    saving, validating,
    handleAddCustomProvider,
  } = form;

  const canSave = customEndpoint.trim() && apiKey.trim() && customModels.length > 0;

  return (
    <>
      <div className="mb-sm form-row">
        <div className="flex-1">
          <div className="form-label text-secondary">{t("providers.customNameLabel")}</div>
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={t("providers.customNamePlaceholder")}
            className="input-full"
          />
        </div>
        <div className="select-min-w-200">
          <div className="form-label text-secondary">{t("providers.customProtocolLabel")}</div>
          <Select
            value={customProtocol}
            onChange={(v) => setCustomProtocol(v as "openai" | "anthropic")}
            options={[
              { value: "openai", label: t("providers.customProtocolOpenAI") },
              { value: "anthropic", label: t("providers.customProtocolAnthropic") },
            ]}
          />
        </div>
      </div>

      <div className="mb-sm">
        <div className="form-label text-secondary">{t("providers.customEndpointLabel")}</div>
        <input
          type="text"
          value={customEndpoint}
          onChange={(e) => setCustomEndpoint(e.target.value)}
          placeholder={t("providers.customEndpointPlaceholder")}
          className="input-full input-mono"
        />
      </div>

      <div className="mb-sm">
        <div className="form-label text-secondary">{t("providers.apiKeyLabel")}</div>
        <input
          type="password"
          autoComplete="off"
          data-1p-ignore
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="input-full input-mono"
        />
      </div>

      <div className="mb-sm">
        <div className="form-label text-secondary">{t("providers.customModelsLabel")}</div>
        <TagInput
          tags={customModels}
          onChange={setCustomModels}
          placeholder={t("providers.customModelsPlaceholder")}
        />
        <small className="form-help-sm">{t("providers.customModelsHelp")}</small>
      </div>

      <ModalityCheckboxGroup inputModalities={inputModalities} setInputModalities={setInputModalities} />

      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={handleAddCustomProvider}
          disabled={saving || validating || !canSave}
        >
          {validating
            ? (validatingLabel || t("providers.validating"))
            : saving
              ? (savingLabel || "...")
              : (saveButtonLabel || t("common.save"))}
        </button>
      </div>
    </>
  );
}
