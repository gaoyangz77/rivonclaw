import { useState } from "react";
import { TagInput } from "../inputs/TagInput.js";
import { Select } from "../inputs/Select.js";
import { ModalityCheckboxGroup } from "./ModalityCheckboxGroup.js";
import { fetchCustomProviderModels } from "../../api/providers.js";
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

  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);

  const canSave = customEndpoint.trim() && apiKey.trim() && customModels.length > 0;
  const canFetchModels = customEndpoint.trim() && apiKey.trim() && customProtocol === "openai";

  async function handleFetchModels() {
    if (!canFetchModels) return;
    setFetchingModels(true);
    setFetchModelsError(null);
    try {
      const models = await fetchCustomProviderModels(
        customEndpoint.trim(), apiKey.trim(), customProtocol,
      );
      setCustomModels(models);
    } catch (err) {
      setFetchModelsError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetchingModels(false);
    }
  }

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
        <div className="form-label-row">
          <div className="form-label text-secondary">{t("providers.customModelsLabel")}</div>
          {customProtocol === "openai" && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={handleFetchModels}
              disabled={!canFetchModels || fetchingModels}
            >
              {fetchingModels ? t("providers.fetchingModels") : t("providers.fetchModels")}
            </button>
          )}
        </div>
        <TagInput
          tags={customModels}
          onChange={setCustomModels}
          placeholder={t("providers.customModelsPlaceholder")}
        />
        {fetchModelsError && (
          <small className="form-error-sm">{fetchModelsError}</small>
        )}
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
