/**
 * RivonClaw Policy Plugin
 *
 * Auto-discovered OpenClaw plugin that injects compiled policies and guard
 * directives into the agent system prompt via a `before_agent_start` hook.
 *
 * Policy and guard data are passed via plugin config (plugins.entries config)
 * by the desktop config writer, which serializes the latest compiled data on
 * every config write (triggered by rule changes).
 *
 * Guard enforcement via before_tool_call is intentionally disabled —
 * the current pattern matcher is too limited (only tool:/path: prefixes)
 * and risks false positives. Guards are instead injected as prompt-level
 * directives until a proper condition DSL is implemented.
 */

import { defineRivonClawPlugin } from "@rivonclaw/plugin-sdk";
import type { PluginApi } from "@rivonclaw/plugin-sdk";
import { createPolicyInjector } from "@rivonclaw/policy";
import type { OpenClawPluginAPI, PolicyProvider, GuardProvider } from "@rivonclaw/policy";

export default defineRivonClawPlugin({
  id: "rivonclaw-policy",
  name: "RivonClaw Policy",

  setup(api: PluginApi) {
    const config = api.pluginConfig as {
      compiledPolicy?: string;
      guards?: Array<{ id: string; ruleId: string; content: string }>;
    } | undefined;

    // Policy data is passed through plugin config by the desktop config writer.
    // If no config is provided, the plugin has nothing to inject.
    const policyProvider: PolicyProvider = {
      getCompiledPolicyView() {
        return config?.compiledPolicy ?? "";
      },
    };

    const guardProvider: GuardProvider = {
      getActiveGuards() {
        return config?.guards ?? [];
      },
    };

    const policyHandler = createPolicyInjector(policyProvider, guardProvider);

    // This plugin uses the registerHook API pattern (OpenClawPluginAPI)
    // rather than the standard api.on pattern.
    const hookApi = api as unknown as OpenClawPluginAPI;
    hookApi.registerHook("before_agent_start", policyHandler);
  },
});
