import { useCallback, useEffect, useRef } from "react";
import { useApolloClient } from "@apollo/client/react";
import type { GQL } from "@rivonclaw/core";
import { AFFILIATE_CAMPAIGN_NAMING_CONTEXT_QUERY } from "../../../api/shops-queries.js";
import { renderCampaignNameTemplate } from "../affiliate-campaign-name-template.js";

/** How long the shop and lead product ids must stay unchanged before the default name is read. */
export const CAMPAIGN_DEFAULT_NAME_DEBOUNCE_MS = 400;

/** The facts the Backend supplies for a default name (ADR-120), copied out of the response. */
export interface CampaignNamingContext {
  template: string;
  businessDeveloperName: string | null;
  businessDeveloperEnglishName: string | null;
  sequence: number;
}

/** Reads the naming facts for a shop and lead product, for the person's own time zone, never from cache. */
export function useCampaignNamingContext(): (
  shopId: string,
  productId: string,
) => Promise<CampaignNamingContext> {
  const client = useApolloClient();
  return useCallback(
    async (shopId, productId) => {
      const result = await client.query<
        { affiliateCampaignNamingContext: GQL.AffiliateCampaignNamingContext },
        { input: GQL.AffiliateCampaignNamingContextInput }
      >({
        query: AFFILIATE_CAMPAIGN_NAMING_CONTEXT_QUERY,
        variables: {
          input: { shopId, productId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        },
        // The sequence moves with every Campaign created.
        fetchPolicy: "network-only",
      });
      const context = result.data?.affiliateCampaignNamingContext;
      if (!context) throw new Error("Campaign naming context response missing");
      return {
        template: context.template,
        businessDeveloperName: context.businessDeveloperName ?? null,
        businessDeveloperEnglishName: context.businessDeveloperEnglishName ?? null,
        sequence: context.sequence,
      };
    },
    [client],
  );
}

/** The default name for the context, or "" when the seller has no template (or it renders to nothing). */
export function defaultCampaignName(
  context: CampaignNamingContext,
  productId: string,
  now: Date = new Date(),
): string {
  if (context.template === "") return "";
  return renderCampaignNameTemplate(context.template, {
    businessDeveloperName: context.businessDeveloperName,
    businessDeveloperEnglishName: context.businessDeveloperEnglishName,
    productId,
    date: now,
    sequence: context.sequence,
  });
}

/**
 * While `enabled`, reads the default name whenever the shop or lead product changes (debounced) and
 * hands it to `onName`; a stale answer is dropped. Nothing is requested until both ids are known, and
 * an empty template changes nothing.
 */
export function useFollowedCampaignDefaultName(input: {
  enabled: boolean;
  shopId: string;
  productId: string;
  onName: (name: string) => void;
  onError: (error: unknown) => void;
}): void {
  const { enabled, shopId, productId } = input;
  const fetchContext = useCampaignNamingContext();
  const handlers = useRef({ onName: input.onName, onError: input.onError });
  useEffect(() => {
    handlers.current = { onName: input.onName, onError: input.onError };
  });
  useEffect(() => {
    if (!enabled || !shopId || !productId) return;
    let stale = false;
    const timer = setTimeout(() => {
      fetchContext(shopId, productId)
        .then((context) => {
          const name = defaultCampaignName(context, productId);
          if (!stale && name) handlers.current.onName(name);
        })
        .catch((error: unknown) => {
          if (!stale) handlers.current.onError(error);
        });
    }, CAMPAIGN_DEFAULT_NAME_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [enabled, shopId, productId, fetchContext]);
}
