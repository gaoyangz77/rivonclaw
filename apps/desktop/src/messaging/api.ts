import { API } from "@rivonclaw/core/api-contract";
import type { ApiContext } from "../app/api-context.js";
import type { EndpointHandler, RouteRegistry } from "../infra/api/route-registry.js";
import { parseBody, sendJson } from "../infra/api/route-utils.js";
import {
  parseTranslationRequest,
  translateMessage,
  TranslationRequestError,
} from "./translation-service.js";

const translate: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (!ctx.authSession?.getAccessToken()) {
    sendJson(res, 401, { error: "Authentication required" });
    return;
  }
  try {
    const input = parseTranslationRequest(await parseBody(req));
    sendJson(res, 200, await translateMessage(input));
  } catch (error) {
    sendJson(res, error instanceof TranslationRequestError ? 400 : 502, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export function registerMessagingHandlers(registry: RouteRegistry): void {
  registry.register(API["messaging.translate"], translate);
}
