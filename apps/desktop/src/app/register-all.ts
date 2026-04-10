import type { RouteRegistry } from "../infra/api/route-registry.js";
import { registerAuthHandlers } from "../auth/api.js";
import { registerSettingsHandlers } from "../settings/api.js";
import { registerProviderHandlers } from "../providers/api.js";
import { registerChannelsHandlers } from "../channels/api.js";
import { registerCsBridgeHandlers } from "../cs-bridge/api.js";
import { registerBrowserProfilesHandlers } from "../browser-profiles/api.js";
import { registerMobileChatHandlers } from "../mobile/api.js";
import { registerChatSessionsHandlers } from "../chat/api.js";
import { registerSkillsHandlers } from "../skills/api.js";
import { registerUsageHandlers } from "../usage/api.js";
import { registerCloudHandlers } from "../cloud/api.js";
import { registerDepsHandlers } from "../deps/api.js";
import { registerDoctorHandlers } from "../doctor/api.js";
import { registerToolRegistryHandlers } from "../gateway/api.js";
import { registerRulesHandlers } from "../rules/api.js";

export function registerAllHandlers(registry: RouteRegistry): void {
  registerAuthHandlers(registry);
  registerSettingsHandlers(registry);
  registerProviderHandlers(registry);
  registerChannelsHandlers(registry);
  registerCsBridgeHandlers(registry);
  registerBrowserProfilesHandlers(registry);
  registerMobileChatHandlers(registry);
  registerChatSessionsHandlers(registry);
  registerSkillsHandlers(registry);
  registerUsageHandlers(registry);
  registerCloudHandlers(registry);
  registerDepsHandlers(registry);
  registerDoctorHandlers(registry);
  registerToolRegistryHandlers(registry);
  registerRulesHandlers(registry);
}
