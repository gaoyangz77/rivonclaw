import { API } from "@rivonclaw/core/api-contract";
import { createLogger } from "@rivonclaw/logger";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { sendJson } from "../infra/api/route-utils.js";

const log = createLogger("deps-routes");

const provisionDeps: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  // Clear the flag so the provisioner doesn't skip
  ctx.storage.settings.set("deps_provisioned", "");

  // Fire-and-forget: the provisioner opens its own BrowserWindow
  import("./index.js")
    .then(({ runDepsProvisioner }) => runDepsProvisioner({ storage: ctx.storage, showAlways: true }))
    .catch((err) => log.error("Failed to run deps provisioner:", err));

  sendJson(res, 200, { ok: true });
};

export function registerDepsHandlers(registry: RouteRegistry): void {
  registry.register(API["deps.provision"], provisionDeps);
}
