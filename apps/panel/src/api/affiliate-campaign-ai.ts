import { GQL } from "@rivonclaw/core";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import { fetchJson } from "./client.js";

export function generateAffiliateCampaignMessageTemplate(input: {
  shopId: string;
  productId: string;
  uiLocale: string;
  guidance?: string;
  mode: GQL.AffiliateCampaignTemplateGenerationMode;
  previousDraft?: string;
}): Promise<GQL.AffiliateCampaignMessageTemplateSuggestion> {
  return fetchJson<GQL.AffiliateCampaignMessageTemplateSuggestion>(
    clientPath(API["affiliate.campaignAi.messageTemplate"]),
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
