import { createLogger } from "@rivonclaw/logger";
import { sendJson } from "./route-utils.js";
import type { RouteHandler } from "./api-context.js";

const log = createLogger("deps-routes");

export const handleDepsRoutes: RouteHandler = async (req, res, _url, pathname, ctx) => {
  if (pathname !== "/api/deps/provision" || req.method !== "POST") {
    return false;
  }

  // Clear the flag so the provisioner doesn't skip
  ctx.storage.settings.set("deps_provisioned", "");

  // Fire-and-forget: the provisioner opens its own BrowserWindow
  import("../deps-provisioner/index.js")
    .then(({ runDepsProvisioner }) => runDepsProvisioner({ storage: ctx.storage, showAlways: true }))
    .catch((err) => log.error("Failed to run deps provisioner:", err));

  sendJson(res, 200, { ok: true });
  return true;
};
