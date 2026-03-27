import { useTranslation } from "react-i18next";
import { useToolRegistry } from "../stores/index.js";

/**
 * Hook that returns a function to resolve a display label for a tool ID.
 * Format: "Category — Name", with i18n translation for both parts.
 * System tools use lowercase i18n keys (read), entitled tools use uppercase (ECOM_GET_ORDER).
 */
export function useToolDisplayLabel(): (toolId: string) => string {
  const { t } = useTranslation();
  const { tools: allTools } = useToolRegistry();

  return (toolId: string) => {
    const tool = allTools.find((ti) => ti.id === toolId);
    const catLabel = tool?.category ? t(`tools.selector.category.${tool.category}`, { defaultValue: "" }) : "";
    const nameLabel = t(`tools.selector.name.${toolId}`, { defaultValue: toolId });
    return catLabel ? `${catLabel} — ${nameLabel}` : nameLabel;
  };
}
