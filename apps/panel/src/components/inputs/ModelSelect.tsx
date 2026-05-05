import { useRef, useState, useEffect } from "react";
import { getDefaultModelForProvider, getProviderMeta } from "@rivonclaw/core";
import type { LLMProvider } from "@rivonclaw/core";
import { fetchModelCatalog } from "../../api/index.js";
import type { CatalogModelEntry } from "../../api/index.js";
import { Select } from "./Select.js";

export function ModelSelect({
  provider,
  value,
  onChange,
  autoSelectLatest = false,
}: {
  provider: string;
  value: string;
  onChange: (modelId: string) => void;
  autoSelectLatest?: boolean;
}) {
  const [catalog, setCatalog] = useState<Record<string, CatalogModelEntry[]>>(
    {},
  );
  const latestDefaultApplied = useRef(false);

  useEffect(() => {
    let cancelled = false;

    function load() {
      fetchModelCatalog()
        .then((data) => {
          if (cancelled) return;
          setCatalog(data);
          if (Object.keys(data).length === 0) {
            // models.json not ready yet (gateway still starting), retry
            setTimeout(load, 2000);
          }
        })
        .catch(() => {
          if (!cancelled) setTimeout(load, 2000);
        });
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const models = (catalog[provider] ?? []).map((m) => ({
    modelId: m.id,
    displayName: m.name,
  }));
  const modelIdsKey = models.map((m) => m.modelId).join("\0");

  useEffect(() => {
    latestDefaultApplied.current = false;
  }, [provider]);

  // Auto-select first model when value is empty
  useEffect(() => {
    if (!value && models.length > 0) {
      onChange(models[0].modelId);
    }
  }, [value, models.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoSelectLatest || latestDefaultApplied.current || models.length === 0) return;

    const typedProvider = provider as LLMProvider;
    const meta = getProviderMeta(typedProvider);
    if (meta?.preferredModel !== "latest") return;

    const latestModelId = models[0].modelId;
    if (value === latestModelId) {
      latestDefaultApplied.current = true;
      return;
    }

    const localDefault = getDefaultModelForProvider(typedProvider)?.modelId;
    const fallbackIds = new Set((meta.fallbackModels ?? []).map((m) => m.modelId));
    const shouldReplaceFallbackDefault =
      !value || value === localDefault || fallbackIds.has(value);

    if (shouldReplaceFallbackDefault) {
      latestDefaultApplied.current = true;
      onChange(latestModelId);
    }
  }, [autoSelectLatest, provider, value, modelIdsKey, onChange]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure the current value is always in the list (e.g. a custom model ID).
  if (value && !models.some((m) => m.modelId === value)) {
    models.push({ modelId: value, displayName: value });
  }

  return (
    <Select
      value={value}
      onChange={onChange}
      options={models.map((m) => ({ value: m.modelId, label: m.displayName }))}
    />
  );
}
