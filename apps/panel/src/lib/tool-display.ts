import { useTranslation } from "react-i18next";
import { useEntityStore } from "../store/EntityStoreProvider.js";

/**
 * Hook that returns a function to resolve a display label for a tool ID.
 * Format: "Category — Name", with i18n translation via ToolModel views
 * (categoryKey / nameKey).
 */
export function useToolDisplayLabel(): (toolId: string) => string {
  const { t } = useTranslation();
  const entityStore = useEntityStore();

  return (toolId: string) => {
    const tool = entityStore.allTools.find((tt) => tt.id === toolId);
    if (!tool) return toolId;

    const catLabel = t(tool.categoryKey, { defaultValue: "" });
    const nameLabel = t(tool.nameKey, { defaultValue: tool.displayName });
    return catLabel ? `${catLabel} — ${nameLabel}` : nameLabel;
  };
}
