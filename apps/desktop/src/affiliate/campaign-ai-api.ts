import { API } from "@rivonclaw/core/api-contract";
import type { ApiContext } from "../app/api-context.js";
import type { EndpointHandler, RouteRegistry } from "../infra/api/route-registry.js";
import { parseBody, sendJson } from "../infra/api/route-utils.js";
import {
  generateCampaignMessageTemplate,
  generateCampaignSearchPhraseSuggestions,
} from "./affiliate-campaign-ai-service.js";

const generateSearchPhrases: EndpointHandler = async (
  req,
  res,
  _url,
  _params,
  ctx: ApiContext,
) => {
  if (!ctx.authSession?.getAccessToken()) {
    sendJson(res, 401, { error: "Authentication required" });
    return;
  }
  try {
    const body = asRecord(await parseBody(req));
    const snapshotRef = requiredString(body.snapshotRef, "snapshotRef");
    const uiLocale = requiredString(body.uiLocale, "uiLocale");
    const excludePhrases = optionalStringArray(body.excludePhrases, "excludePhrases");
    const guidance = optionalString(body.guidance, "guidance");
    const result = await generateCampaignSearchPhraseSuggestions({
      authSession: ctx.authSession,
      snapshotRef,
      uiLocale,
      excludePhrases,
      guidance,
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendCampaignAiError(res, error);
  }
};

const generateMessageTemplate: EndpointHandler = async (
  req,
  res,
  _url,
  _params,
  ctx: ApiContext,
) => {
  if (!ctx.authSession?.getAccessToken()) {
    sendJson(res, 401, { error: "Authentication required" });
    return;
  }
  try {
    const body = asRecord(await parseBody(req));
    const mode = body.mode;
    if (mode !== "INITIAL" && mode !== "ALTERNATIVE") {
      throw new CampaignAiRequestError("mode must be INITIAL or ALTERNATIVE");
    }
    const result = await generateCampaignMessageTemplate({
      authSession: ctx.authSession,
      snapshotRef: requiredString(body.snapshotRef, "snapshotRef"),
      uiLocale: requiredString(body.uiLocale, "uiLocale"),
      guidance: optionalString(body.guidance, "guidance"),
      mode,
      previousDraft: optionalString(body.previousDraft, "previousDraft"),
    });
    sendJson(res, 200, result);
  } catch (error) {
    sendCampaignAiError(res, error);
  }
};

export function registerAffiliateCampaignAiHandlers(registry: RouteRegistry): void {
  registry.register(API["affiliate.campaignAi.searchPhrases"], generateSearchPhrases);
  registry.register(API["affiliate.campaignAi.messageTemplate"], generateMessageTemplate);
}

class CampaignAiRequestError extends Error {}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CampaignAiRequestError("Request body must be a JSON object");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new CampaignAiRequestError(`${field} is required`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new CampaignAiRequestError(`${field} must be a string`);
  }
  return value.trim() || undefined;
}

function optionalStringArray(value: unknown, field: string): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new CampaignAiRequestError(`${field} must be a string array`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function sendCampaignAiError(
  res: Parameters<typeof sendJson>[0],
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  sendJson(res, error instanceof CampaignAiRequestError ? 400 : 502, {
    error: message,
  });
}
