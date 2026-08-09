import { createLogger } from "@rivonclaw/logger";
import { DEFAULTS, type SttProvider as SttProviderType } from "@rivonclaw/core";

const log = createLogger("gateway:audio-config");

interface AudioModelConfig {
  provider?: string;
  model?: string;
  type: "provider" | "cli";
  command?: string;
  args?: string[];
  capabilities: ["audio"];
  language?: string;
}

interface GeneratedAudioConfig {
  audio: Record<string, unknown>;
  models: AudioModelConfig[];
}

/**
 * Generate OpenClaw audio understanding configuration based on RivonClaw STT settings.
 *
 * OpenClaw keeps shared media models at `tools.media.models`; the
 * `tools.media.audio` object contains only audio policy and limits.
 *
 * @param enabled - Whether STT is enabled
 * @param provider - STT provider (groq or volcengine)
 * @param options - Additional options for CLI-based providers
 * @returns OpenClaw tools.media.audio configuration object
 */
export function generateAudioConfig(
  enabled: boolean,
  provider: SttProviderType,
  options?: {
    /** Absolute path to the Node.js binary (for CLI-based providers). */
    nodeBin?: string;
    /** Absolute path to the Volcengine STT CLI script. */
    sttCliPath?: string;
  },
): GeneratedAudioConfig | null {
  if (!enabled) {
    return null;
  }

  const models: AudioModelConfig[] = [];

  if (provider === "groq") {
    // Groq has native support in OpenClaw with whisper-large-v3-turbo
    models.push({
      provider: "groq",
      model: "whisper-large-v3-turbo",
      type: "provider",
      capabilities: ["audio"],
    });
  } else if (provider === "volcengine") {
    // Volcengine is not natively supported in OpenClaw, so we use a CLI bridge script.
    // The script reads VOLCENGINE_APP_KEY and VOLCENGINE_ACCESS_KEY from env vars
    // (already injected by secret-injector.ts) and calls the Volcengine API.
    if (options?.nodeBin && options?.sttCliPath) {
      models.push({
        type: "cli",
        command: options.nodeBin,
        args: [options.sttCliPath, "{{MediaPath}}"],
        capabilities: ["audio"],
      });
    } else {
      log.warn("Volcengine STT requires nodeBin and sttCliPath; skipping audio config");
    }
  }

  if (models.length === 0) {
    log.warn(`No audio models configured for provider: ${provider}`);
    return null;
  }

  return {
    models,
    audio: {
      enabled: true,
      maxBytes: DEFAULTS.gatewayConfig.audioMaxBytes,
      timeoutSeconds: DEFAULTS.gatewayConfig.audioTimeoutSeconds,
      scope: {
        default: "allow",
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isManagedAudioModel(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    value.provider === "groq" &&
    value.model === "whisper-large-v3-turbo" &&
    value.type === "provider"
  ) {
    return true;
  }
  return (
    value.type === "cli" &&
    Array.isArray(value.args) &&
    value.args.some(
      (arg) => typeof arg === "string" && /(?:^|[/\\])volcengine-stt-cli\.mjs$/u.test(arg),
    )
  );
}

/**
 * Merge audio configuration into OpenClaw config object.
 *
 * This writes to tools.media.audio in the config.
 *
 * @param config - Existing OpenClaw config object
 * @param audioConfig - Audio configuration from generateAudioConfig()
 * @returns Updated config object
 */
export function mergeAudioConfig(
  config: Record<string, unknown>,
  audioConfig: GeneratedAudioConfig | null,
): Record<string, unknown> {
  const tools = isRecord(config.tools) ? config.tools : {};
  const media = isRecord(tools.media) ? tools.media : {};
  const currentAudio = isRecord(media.audio) ? media.audio : undefined;
  const legacyNestedModels = Array.isArray(currentAudio?.models) ? currentAudio.models : [];
  const currentModels = Array.isArray(media.models) ? media.models : [];
  const preservedModels = [...currentModels, ...legacyNestedModels].filter(
    (model) => !isManagedAudioModel(model),
  );

  if (!audioConfig) {
    delete media.audio;
    if (preservedModels.length > 0) media.models = preservedModels;
    else delete media.models;
    tools.media = media;
    config.tools = tools;
    return config;
  }

  media.audio = audioConfig.audio;
  media.models = [...preservedModels, ...audioConfig.models];
  tools.media = media;
  config.tools = tools;

  log.info("Audio configuration merged into OpenClaw config");
  return config;
}
