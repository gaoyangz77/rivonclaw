/**
 * Tool visibility strategy — determines how tools are registered with OpenClaw.
 *
 * - "managed": Tools registered with { optional: true }.
 *   Visibility controlled by effectiveTools allowlist (four-layer model).
 *   Used when tool access depends on entitlement, surface, or run profile.
 *
 * - "always": Tools registered without optional flag (always visible to LLM).
 *   Used for system-level tools that should always be available.
 *
 * When `tools` is not provided, the plugin registers no tools regardless
 * of this setting (pure hook / gateway-method plugins).
 */
export type ToolVisibility = "managed" | "always";

// Minimal OpenClaw plugin API types (inline to avoid vendor dependency)
export type PluginApi = {
  id: string;
  logger: { info: (msg: string) => void; warn: (msg: string) => void };
  pluginConfig?: Record<string, unknown>;
  on(event: string, handler: (...args: any[]) => any, opts?: { priority?: number }): void;
  registerTool?(factory: (ctx: { config?: Record<string, unknown> }) => unknown, opts?: { optional?: boolean }): void;
  registerGatewayMethod?(name: string, handler: (args: {
    params: Record<string, unknown>;
    respond: (ok: boolean, payload?: unknown, error?: { code: string; message: string }) => void;
    context?: { broadcast: (event: string, payload: unknown) => void };
  }) => void): void;
};

/** Tool definition — what plugins provide. */
export interface ToolDefinition {
  name: string;
  label?: string;
  description: string;
  parameters: Record<string, unknown>;
  run?: (...args: any[]) => any;
  [key: string]: unknown;
}

/** Plugin definition — what plugin authors write. */
export interface RivonClawPluginOptions {
  id: string;
  name: string;

  /**
   * Tool definitions to register with the gateway.
   * Omit for pure hook / gateway-method plugins (e.g. file-permissions).
   */
  tools?: ToolDefinition[];

  /**
   * How tools are registered with OpenClaw (default: "managed").
   *
   * - "managed" — { optional: true }, visibility controlled by effectiveTools allowlist.
   * - "always" — non-optional, always visible to the LLM.
   *
   * Only relevant when `tools` is provided.
   */
  toolVisibility?: ToolVisibility;

  /**
   * Business logic setup. Called with the OpenClaw plugin API.
   * Plugin authors implement ONLY business logic here — tool registration,
   * visibility control, and framework wiring are handled by the SDK.
   */
  setup?: (api: PluginApi) => void;
}

/** OpenClaw plugin shape (what OpenClaw expects). */
export interface OpenClawPlugin {
  id: string;
  name: string;
  activate(api: PluginApi): void;
  /** Channel plugins require register() — aliased to activate(). */
  register(api: PluginApi): void;
}

/**
 * Define a RivonClaw plugin with declarative tool registration
 * and automatic framework wiring.
 *
 * Tool registration strategy is determined by `toolVisibility`:
 * - "managed" (default) → { optional: true }, controlled by effectiveTools
 * - "always" → non-optional, always visible
 * - No `tools` → no tools registered (hook-only plugins)
 */
export function defineRivonClawPlugin(options: RivonClawPluginOptions): OpenClawPlugin {
  const visibility = options.toolVisibility ?? "managed";

  const plugin = {
    id: options.id,
    name: options.name,
    activate(api: PluginApi) {
      // 1. Register tools based on visibility strategy
      if (options.tools) {
        const toolOpts = visibility === "managed" ? { optional: true } : undefined;
        for (const toolDef of options.tools) {
          if (typeof api.registerTool === "function") {
            api.registerTool(() => toolDef, toolOpts);
          }
        }
      }

      // 2. Run plugin's business logic
      if (options.setup) {
        options.setup(api);
      }

      api.logger.info(`${options.name} plugin activated`);
    },
    // OpenClaw channel plugins require register() — alias to activate so
    // channel registration happens regardless of which lifecycle method
    // the engine calls.  Use plugin.activate (not this.activate) to avoid
    // broken `this` binding when OpenClaw calls register() as a detached function.
    register(api: PluginApi) {
      plugin.activate(api);
    },
  };

  return plugin;
}
