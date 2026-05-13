// AUTO-GENERATED from vendor/openclaw — do not edit manually.
// Re-generate with: node scripts/generate-vendor-artifacts.mjs

// vendor/openclaw/src/config/zod-schema.ts
import { z as z18 } from "zod";

// vendor/openclaw/src/shared/string-coerce.ts
function normalizeNullableString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
function normalizeOptionalString(value) {
  return normalizeNullableString(value) ?? void 0;
}
function normalizeStringifiedOptionalString(value) {
  if (typeof value === "string") {
    return normalizeOptionalString(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return normalizeOptionalString(String(value));
  }
  return void 0;
}
function normalizeOptionalLowercaseString(value) {
  return normalizeOptionalString(value)?.toLowerCase();
}
function normalizeLowercaseStringOrEmpty(value) {
  return normalizeOptionalLowercaseString(value) ?? "";
}

// vendor/openclaw/src/cli/parse-bytes.ts
var UNIT_MULTIPLIERS = {
  b: 1,
  kb: 1024,
  k: 1024,
  mb: 1024 ** 2,
  m: 1024 ** 2,
  gb: 1024 ** 3,
  g: 1024 ** 3,
  tb: 1024 ** 4,
  t: 1024 ** 4
};
function parseByteSize(raw, opts) {
  const trimmed = normalizeLowercaseStringOrEmpty(normalizeOptionalString(raw) ?? "");
  if (!trimmed) {
    throw new Error("invalid byte size (empty)");
  }
  const m = /^(\d+(?:\.\d+)?)([a-z]+)?$/.exec(trimmed);
  if (!m) {
    throw new Error(`invalid byte size: ${raw}`);
  }
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`invalid byte size: ${raw}`);
  }
  const unit = normalizeLowercaseStringOrEmpty(m[2] ?? opts?.defaultUnit ?? "b");
  const multiplier = UNIT_MULTIPLIERS[unit];
  if (!multiplier) {
    throw new Error(`invalid byte size unit: ${raw}`);
  }
  const bytes = Math.round(value * multiplier);
  if (!Number.isFinite(bytes)) {
    throw new Error(`invalid byte size: ${raw}`);
  }
  return bytes;
}

// vendor/openclaw/src/cli/parse-duration.ts
var DURATION_MULTIPLIERS = {
  ms: 1,
  s: 1e3,
  m: 6e4,
  h: 36e5,
  d: 864e5
};
function parseDurationMs(raw, opts) {
  const trimmed = normalizeLowercaseStringOrEmpty(normalizeOptionalString(raw) ?? "");
  if (!trimmed) {
    throw new Error("invalid duration (empty)");
  }
  const single = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/.exec(trimmed);
  if (single) {
    const value = Number(single[1]);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`invalid duration: ${raw}`);
    }
    const unit = single[2] ?? opts?.defaultUnit ?? "ms";
    const ms2 = Math.round(value * DURATION_MULTIPLIERS[unit]);
    if (!Number.isFinite(ms2)) {
      throw new Error(`invalid duration: ${raw}`);
    }
    return ms2;
  }
  let totalMs = 0;
  let consumed = 0;
  const tokenRe = /(\d+(?:\.\d+)?)(ms|s|m|h|d)/g;
  for (const match of trimmed.matchAll(tokenRe)) {
    const [full, valueRaw, unitRaw] = match;
    const index = match.index ?? -1;
    if (!full || !valueRaw || !unitRaw || index < 0) {
      throw new Error(`invalid duration: ${raw}`);
    }
    if (index !== consumed) {
      throw new Error(`invalid duration: ${raw}`);
    }
    const value = Number(valueRaw);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`invalid duration: ${raw}`);
    }
    const multiplier = DURATION_MULTIPLIERS[unitRaw];
    if (!multiplier) {
      throw new Error(`invalid duration: ${raw}`);
    }
    totalMs += value * multiplier;
    consumed += full.length;
  }
  if (consumed !== trimmed.length || consumed === 0) {
    throw new Error(`invalid duration: ${raw}`);
  }
  const ms = Math.round(totalMs);
  if (!Number.isFinite(ms)) {
    throw new Error(`invalid duration: ${raw}`);
  }
  return ms;
}

// vendor/openclaw/src/config/control-ui-css.ts
var CSS_WIDTH_KEYWORDS = /* @__PURE__ */ new Set(["none", "min-content", "max-content"]);
var CSS_WIDTH_FUNCTIONS = /* @__PURE__ */ new Set(["calc", "clamp", "fit-content", "max", "min"]);
var CSS_WIDTH_UNITS = /* @__PURE__ */ new Set(["ch", "em", "rem", "vh", "vmax", "vmin", "vw", "px"]);
var CSS_WIDTH_ALLOWED_CHARS = /^[0-9A-Za-z.%+\-*/(),\s]+$/;
var CSS_WIDTH_IDENTIFIER_RE = /[A-Za-z][A-Za-z0-9-]*/g;
var CSS_WIDTH_SIMPLE_RE = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|ch|vw|vh|vmin|vmax|%)$/i;
var CSS_WIDTH_MAX_LENGTH = 96;
function hasBalancedParentheses(value) {
  let depth = 0;
  for (const char of value) {
    if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth < 0) {
        return false;
      }
    }
  }
  return depth === 0;
}
function hasAllowedIdentifiers(value) {
  for (const match of value.matchAll(CSS_WIDTH_IDENTIFIER_RE)) {
    const identifier = match[0].toLowerCase();
    if (!CSS_WIDTH_FUNCTIONS.has(identifier) && !CSS_WIDTH_KEYWORDS.has(identifier) && !CSS_WIDTH_UNITS.has(identifier)) {
      return false;
    }
  }
  return true;
}
function normalizeControlUiChatMessageMaxWidth(value) {
  return value.trim().replace(/\s+/g, " ");
}
function isValidControlUiChatMessageMaxWidth(value) {
  const normalized = normalizeControlUiChatMessageMaxWidth(value);
  if (normalized.length === 0 || normalized.length > CSS_WIDTH_MAX_LENGTH) {
    return false;
  }
  if (CSS_WIDTH_KEYWORDS.has(normalized.toLowerCase())) {
    return true;
  }
  if (CSS_WIDTH_SIMPLE_RE.test(normalized)) {
    return true;
  }
  if (!CSS_WIDTH_ALLOWED_CHARS.test(normalized)) {
    return false;
  }
  if (!hasBalancedParentheses(normalized) || !hasAllowedIdentifiers(normalized)) {
    return false;
  }
  return /^(?:calc|clamp|fit-content|max|min)\(.+\)$/i.test(normalized);
}

// vendor/openclaw/src/config/zod-schema.agent-defaults.ts
import { z as z6 } from "zod";

// vendor/openclaw/src/config/byte-size.ts
function parseNonNegativeByteSize(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const int = Math.floor(value);
    return int >= 0 ? int : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const bytes = parseByteSize(trimmed, { defaultUnit: "b" });
      return bytes >= 0 ? bytes : null;
    } catch {
      return null;
    }
  }
  return null;
}
function isValidNonNegativeByteSizeString(value) {
  return parseNonNegativeByteSize(value) !== null;
}

// vendor/openclaw/src/config/zod-schema.agent-runtime.ts
import { z as z5 } from "zod";

// vendor/openclaw/src/agents/sandbox/bind-spec.ts
function splitSandboxBindSpec(spec) {
  const separator = getHostContainerSeparatorIndex(spec);
  if (separator === -1) {
    return null;
  }
  const host = spec.slice(0, separator);
  const rest = spec.slice(separator + 1);
  const optionsStart = rest.indexOf(":");
  if (optionsStart === -1) {
    return { host, container: rest, options: "" };
  }
  return {
    host,
    container: rest.slice(0, optionsStart),
    options: rest.slice(optionsStart + 1)
  };
}
function getHostContainerSeparatorIndex(spec) {
  const hasDriveLetterPrefix = /^[A-Za-z]:[\\/]/.test(spec);
  for (let i = hasDriveLetterPrefix ? 2 : 0; i < spec.length; i += 1) {
    if (spec[i] === ":") {
      return i;
    }
  }
  return -1;
}

// vendor/openclaw/src/infra/boundary-path.ts
var BOUNDARY_PATH_ALIAS_POLICIES = {
  strict: Object.freeze({
    allowFinalSymlinkForUnlink: false,
    allowFinalHardlinkForUnlink: false
  }),
  unlinkTarget: Object.freeze({
    allowFinalSymlinkForUnlink: true,
    allowFinalHardlinkForUnlink: true
  })
};

// vendor/openclaw/src/agents/sandbox/host-paths.ts
function stripWindowsNamespacePrefix(input) {
  if (input.startsWith("\\\\?\\")) {
    const withoutPrefix = input.slice(4);
    if (withoutPrefix.toUpperCase().startsWith("UNC\\")) {
      return `\\\\${withoutPrefix.slice(4)}`;
    }
    return withoutPrefix;
  }
  if (input.startsWith("//?/")) {
    const withoutPrefix = input.slice(4);
    if (withoutPrefix.toUpperCase().startsWith("UNC/")) {
      return `//${withoutPrefix.slice(4)}`;
    }
    return withoutPrefix;
  }
  return input;
}
function isWindowsDriveAbsolutePath(raw) {
  return /^[A-Za-z]:[\\/]/.test(stripWindowsNamespacePrefix(raw.trim()));
}
function isSandboxHostPathAbsolute(raw) {
  const trimmed = stripWindowsNamespacePrefix(raw.trim());
  return trimmed.startsWith("/") || isWindowsDriveAbsolutePath(trimmed);
}

// vendor/openclaw/src/agents/sandbox/network-mode.ts
function normalizeNetworkMode(network) {
  const normalized = normalizeOptionalLowercaseString(network);
  return normalized || void 0;
}
function getBlockedNetworkModeReason(params) {
  const normalized = normalizeNetworkMode(params.network);
  if (!normalized) {
    return null;
  }
  if (normalized === "host") {
    return "host";
  }
  if (normalized.startsWith("container:") && params.allowContainerNamespaceJoin !== true) {
    return "container_namespace_join";
  }
  return null;
}

// vendor/openclaw/src/config/zod-schema.agent-model.ts
import { z } from "zod";
var AgentModelSchema = z.union([
  z.string(),
  z.object({
    primary: z.string().optional(),
    fallbacks: z.array(z.string()).optional(),
    timeoutMs: z.number().int().positive().optional()
  }).strict()
]);

// vendor/openclaw/src/config/zod-schema.core.ts
import path3 from "node:path";
import { z as z4 } from "zod";

// vendor/openclaw/src/infra/exec-safety.ts
var SHELL_METACHARS = /[;&|`$<>]/;
var CONTROL_CHARS = /[\r\n]/;
var QUOTE_CHARS = /["']/;
var BARE_NAME_PATTERN = /^[A-Za-z0-9._+-]+$/;
function isLikelyPath(value) {
  if (value.startsWith(".") || value.startsWith("~")) {
    return true;
  }
  if (value.includes("/") || value.includes("\\")) {
    return true;
  }
  return /^[A-Za-z]:[\\/]/.test(value);
}
function isSafeExecutableValue(value) {
  if (!value) {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.includes("\0")) {
    return false;
  }
  if (CONTROL_CHARS.test(trimmed)) {
    return false;
  }
  if (SHELL_METACHARS.test(trimmed)) {
    return false;
  }
  if (QUOTE_CHARS.test(trimmed)) {
    return false;
  }
  if (isLikelyPath(trimmed)) {
    return true;
  }
  if (trimmed.startsWith("-")) {
    return false;
  }
  return BARE_NAME_PATTERN.test(trimmed);
}

// vendor/openclaw/src/utils.ts
import fs from "node:fs";
import os2 from "node:os";
import path2 from "node:path";

// vendor/openclaw/src/infra/home-dir.ts
import os from "node:os";
import path from "node:path";
function normalize(value) {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) {
    return void 0;
  }
  if (trimmed === "undefined" || trimmed === "null") {
    return void 0;
  }
  return trimmed;
}
function resolveEffectiveHomeDir(env = process.env, homedir = os.homedir) {
  const raw = resolveRawHomeDir(env, homedir);
  return raw ? path.resolve(raw) : void 0;
}
function resolveRawHomeDir(env, homedir) {
  const explicitHome = normalize(env.OPENCLAW_HOME);
  if (explicitHome) {
    if (explicitHome === "~" || explicitHome.startsWith("~/") || explicitHome.startsWith("~\\")) {
      const fallbackHome = resolveRawOsHomeDir(env, homedir);
      if (fallbackHome) {
        return explicitHome.replace(/^~(?=$|[\\/])/, fallbackHome);
      }
      return void 0;
    }
    return explicitHome;
  }
  return resolveRawOsHomeDir(env, homedir);
}
function resolveRawOsHomeDir(env, homedir) {
  const envHome = normalize(env.HOME);
  if (envHome) {
    return envHome;
  }
  const userProfile = normalize(env.USERPROFILE);
  if (userProfile) {
    return userProfile;
  }
  return normalizeSafe(homedir);
}
function normalizeSafe(homedir) {
  try {
    return normalize(homedir());
  } catch {
    return void 0;
  }
}
function resolveRequiredHomeDir(env = process.env, homedir = os.homedir) {
  return resolveEffectiveHomeDir(env, homedir) ?? path.resolve(process.cwd());
}
function expandHomePrefix(input, opts) {
  if (!input.startsWith("~")) {
    return input;
  }
  const home = normalize(opts?.home) ?? resolveEffectiveHomeDir(opts?.env ?? process.env, opts?.homedir ?? os.homedir);
  if (!home) {
    return input;
  }
  return input.replace(/^~(?=$|[\\/])/, home);
}
function resolveHomeRelativePath(input, opts) {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith("~")) {
    const expanded = expandHomePrefix(trimmed, {
      home: resolveRequiredHomeDir(opts?.env ?? process.env, opts?.homedir ?? os.homedir),
      env: opts?.env,
      homedir: opts?.homedir
    });
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
}

// vendor/openclaw/src/utils.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function resolveUserPath(input, env = process.env, homedir = os2.homedir) {
  if (!input) {
    return "";
  }
  return resolveHomeRelativePath(input, { env, homedir });
}
function resolveConfigDir(env = process.env, homedir = os2.homedir) {
  const override = env.OPENCLAW_STATE_DIR?.trim();
  if (override) {
    return resolveUserPath(override, env, homedir);
  }
  const configPath = env.OPENCLAW_CONFIG_PATH?.trim();
  if (configPath) {
    return path2.dirname(resolveUserPath(configPath, env, homedir));
  }
  const newDir = path2.join(resolveRequiredHomeDir(env, homedir), ".openclaw");
  try {
    const hasNew = fs.existsSync(newDir);
    if (hasNew) {
      return newDir;
    }
  } catch {
  }
  return newDir;
}
var CONFIG_DIR = resolveConfigDir();

// vendor/openclaw/src/config/types.secrets.ts
var DEFAULT_SECRET_PROVIDER_ALIAS = "default";
var ENV_SECRET_TEMPLATE_RE = /^\$\{([A-Z][A-Z0-9_]{0,127})\}$/;
function isSecretRef(value) {
  if (!isRecord(value)) {
    return false;
  }
  if (Object.keys(value).length !== 3) {
    return false;
  }
  return (value.source === "env" || value.source === "file" || value.source === "exec") && typeof value.provider === "string" && value.provider.trim().length > 0 && typeof value.id === "string" && value.id.trim().length > 0;
}
function isLegacySecretRefWithoutProvider(value) {
  if (!isRecord(value)) {
    return false;
  }
  return (value.source === "env" || value.source === "file" || value.source === "exec") && typeof value.id === "string" && value.id.trim().length > 0 && value.provider === void 0;
}
function parseEnvTemplateSecretRef(value, provider = DEFAULT_SECRET_PROVIDER_ALIAS) {
  if (typeof value !== "string") {
    return null;
  }
  const match = ENV_SECRET_TEMPLATE_RE.exec(value.trim());
  if (!match) {
    return null;
  }
  return {
    source: "env",
    provider: provider.trim() || DEFAULT_SECRET_PROVIDER_ALIAS,
    id: match[1]
  };
}
function coerceSecretRef(value, defaults) {
  if (isSecretRef(value)) {
    return value;
  }
  if (isLegacySecretRefWithoutProvider(value)) {
    const provider = value.source === "env" ? defaults?.env ?? DEFAULT_SECRET_PROVIDER_ALIAS : value.source === "file" ? defaults?.file ?? DEFAULT_SECRET_PROVIDER_ALIAS : defaults?.exec ?? DEFAULT_SECRET_PROVIDER_ALIAS;
    return {
      source: value.source,
      provider,
      id: value.id
    };
  }
  const envTemplate = parseEnvTemplateSecretRef(value, defaults?.env);
  if (envTemplate) {
    return envTemplate;
  }
  return null;
}
function hasConfiguredSecretInput(value, defaults) {
  if (normalizeSecretInputString(value)) {
    return true;
  }
  return coerceSecretRef(value, defaults) !== null;
}
function normalizeSecretInputString(value) {
  if (typeof value !== "string") {
    return void 0;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : void 0;
}

// vendor/openclaw/src/secrets/ref-contract.ts
var FILE_SECRET_REF_SEGMENT_PATTERN = /^(?:[^~]|~0|~1)*$/;
var EXEC_SECRET_REF_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
var SINGLE_VALUE_FILE_REF_ID = "value";
function isValidFileSecretRefId(value) {
  if (value === SINGLE_VALUE_FILE_REF_ID) {
    return true;
  }
  if (!value.startsWith("/")) {
    return false;
  }
  return value.slice(1).split("/").every((segment) => FILE_SECRET_REF_SEGMENT_PATTERN.test(segment));
}
function validateExecSecretRefId(value) {
  if (!EXEC_SECRET_REF_ID_PATTERN.test(value)) {
    return { ok: false, reason: "pattern" };
  }
  for (const segment of value.split("/")) {
    if (segment === "." || segment === "..") {
      return { ok: false, reason: "traversal-segment" };
    }
  }
  return { ok: true };
}
function isValidExecSecretRefId(value) {
  return validateExecSecretRefId(value).ok;
}
function formatExecSecretRefIdValidationMessage() {
  return [
    "Exec secret reference id must match /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/",
    'and must not include "." or ".." path segments',
    '(example: "vault/openai/api-key").'
  ].join(" ");
}

// vendor/openclaw/src/shared/string-normalization.ts
function normalizeStringEntries(list) {
  return (list ?? []).map((entry) => normalizeOptionalString(String(entry)) ?? "").filter(Boolean);
}

// vendor/openclaw/src/config/types.models.ts
var MODEL_APIS = [
  "openai-completions",
  "openai-responses",
  "openai-codex-responses",
  "anthropic-messages",
  "google-generative-ai",
  "github-copilot",
  "bedrock-converse-stream",
  "ollama",
  "azure-openai-responses"
];

// vendor/openclaw/src/config/zod-schema.allowdeny.ts
import { z as z2 } from "zod";
var AllowDenyActionSchema = z2.union([z2.literal("allow"), z2.literal("deny")]);
var AllowDenyChatTypeSchema = z2.union([
  z2.literal("direct"),
  z2.literal("group"),
  z2.literal("channel"),
  /** @deprecated Use `direct` instead. Kept for backward compatibility. */
  z2.literal("dm")
]).optional();
function createAllowDenyChannelRulesSchema() {
  return z2.object({
    default: AllowDenyActionSchema.optional(),
    rules: z2.array(
      z2.object({
        action: AllowDenyActionSchema,
        match: z2.object({
          channel: z2.string().optional(),
          chatType: AllowDenyChatTypeSchema,
          keyPrefix: z2.string().optional(),
          rawKeyPrefix: z2.string().optional()
        }).strict().optional()
      }).strict()
    ).optional()
  }).strict().optional();
}

// vendor/openclaw/src/config/zod-schema.sensitive.ts
import { z as z3 } from "zod";
var sensitive = z3.registry();

// vendor/openclaw/src/config/zod-schema.core.ts
var ENV_SECRET_REF_ID_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;
var SECRET_PROVIDER_ALIAS_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
var WINDOWS_ABS_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
var WINDOWS_UNC_PATH_PATTERN = /^\\\\[^\\]+\\[^\\]+/;
function isAbsolutePath(value) {
  return path3.isAbsolute(value) || WINDOWS_ABS_PATH_PATTERN.test(value) || WINDOWS_UNC_PATH_PATTERN.test(value);
}
var EnvSecretRefSchema = z4.object({
  source: z4.literal("env"),
  provider: z4.string().regex(
    SECRET_PROVIDER_ALIAS_PATTERN,
    'Secret reference provider must match /^[a-z][a-z0-9_-]{0,63}$/ (example: "default").'
  ),
  id: z4.string().regex(
    ENV_SECRET_REF_ID_PATTERN,
    'Env secret reference id must match /^[A-Z][A-Z0-9_]{0,127}$/ (example: "OPENAI_API_KEY").'
  )
}).strict();
var FileSecretRefSchema = z4.object({
  source: z4.literal("file"),
  provider: z4.string().regex(
    SECRET_PROVIDER_ALIAS_PATTERN,
    'Secret reference provider must match /^[a-z][a-z0-9_-]{0,63}$/ (example: "default").'
  ),
  id: z4.string().refine(
    isValidFileSecretRefId,
    'File secret reference id must be an absolute JSON pointer (example: "/providers/openai/apiKey"), or "value" for singleValue mode.'
  )
}).strict();
var ExecSecretRefSchema = z4.object({
  source: z4.literal("exec"),
  provider: z4.string().regex(
    SECRET_PROVIDER_ALIAS_PATTERN,
    'Secret reference provider must match /^[a-z][a-z0-9_-]{0,63}$/ (example: "default").'
  ),
  id: z4.string().refine(isValidExecSecretRefId, formatExecSecretRefIdValidationMessage())
}).strict();
var SecretRefSchema = z4.discriminatedUnion("source", [
  EnvSecretRefSchema,
  FileSecretRefSchema,
  ExecSecretRefSchema
]);
var SecretInputSchema = z4.union([z4.string(), SecretRefSchema]);
var SecretsEnvProviderSchema = z4.object({
  source: z4.literal("env"),
  allowlist: z4.array(z4.string().regex(ENV_SECRET_REF_ID_PATTERN)).max(256).optional()
}).strict();
var SecretsFileProviderSchema = z4.object({
  source: z4.literal("file"),
  path: z4.string().min(1),
  mode: z4.union([z4.literal("singleValue"), z4.literal("json")]).optional(),
  timeoutMs: z4.number().int().positive().max(12e4).optional(),
  maxBytes: z4.number().int().positive().max(20 * 1024 * 1024).optional(),
  allowInsecurePath: z4.boolean().optional()
}).strict();
var SecretsExecProviderSchema = z4.object({
  source: z4.literal("exec"),
  command: z4.string().min(1).refine((value) => isSafeExecutableValue(value), "secrets.providers.*.command is unsafe.").refine(
    (value) => isAbsolutePath(value),
    "secrets.providers.*.command must be an absolute path."
  ),
  args: z4.array(z4.string().max(1024)).max(128).optional(),
  timeoutMs: z4.number().int().positive().max(12e4).optional(),
  noOutputTimeoutMs: z4.number().int().positive().max(12e4).optional(),
  maxOutputBytes: z4.number().int().positive().max(20 * 1024 * 1024).optional(),
  jsonOnly: z4.boolean().optional(),
  env: z4.record(z4.string(), z4.string()).optional(),
  passEnv: z4.array(z4.string().regex(ENV_SECRET_REF_ID_PATTERN)).max(128).optional(),
  trustedDirs: z4.array(
    z4.string().min(1).refine((value) => isAbsolutePath(value), "trustedDirs entries must be absolute paths.")
  ).max(64).optional(),
  allowInsecurePath: z4.boolean().optional(),
  allowSymlinkCommand: z4.boolean().optional()
}).strict();
var SecretProviderSchema = z4.discriminatedUnion("source", [
  SecretsEnvProviderSchema,
  SecretsFileProviderSchema,
  SecretsExecProviderSchema
]);
var SecretsConfigSchema = z4.object({
  providers: z4.object({
    // Keep this as a record so users can define multiple providers per source.
  }).catchall(SecretProviderSchema).optional(),
  defaults: z4.object({
    env: z4.string().regex(SECRET_PROVIDER_ALIAS_PATTERN).optional(),
    file: z4.string().regex(SECRET_PROVIDER_ALIAS_PATTERN).optional(),
    exec: z4.string().regex(SECRET_PROVIDER_ALIAS_PATTERN).optional()
  }).strict().optional(),
  resolution: z4.object({
    maxProviderConcurrency: z4.number().int().positive().max(16).optional(),
    maxRefsPerProvider: z4.number().int().positive().max(4096).optional(),
    maxBatchBytes: z4.number().int().positive().max(5 * 1024 * 1024).optional()
  }).strict().optional()
}).strict().optional();
var ModelApiSchema = z4.enum(MODEL_APIS);
var ModelCompatSchema = z4.object({
  supportsStore: z4.boolean().optional(),
  supportsPromptCacheKey: z4.boolean().optional(),
  supportsDeveloperRole: z4.boolean().optional(),
  supportsReasoningEffort: z4.boolean().optional(),
  supportsUsageInStreaming: z4.boolean().optional(),
  supportsTools: z4.boolean().optional(),
  supportsStrictMode: z4.boolean().optional(),
  requiresStringContent: z4.boolean().optional(),
  visibleReasoningDetailTypes: z4.array(z4.string().min(1)).optional(),
  supportedReasoningEfforts: z4.array(z4.string().min(1)).optional(),
  reasoningEffortMap: z4.record(z4.string().min(1), z4.string().min(1)).optional(),
  maxTokensField: z4.union([z4.literal("max_completion_tokens"), z4.literal("max_tokens")]).optional(),
  thinkingFormat: z4.union([
    z4.literal("openai"),
    z4.literal("openrouter"),
    z4.literal("deepseek"),
    z4.literal("zai")
  ]).optional(),
  requiresToolResultName: z4.boolean().optional(),
  requiresAssistantAfterToolResult: z4.boolean().optional(),
  requiresThinkingAsText: z4.boolean().optional(),
  toolSchemaProfile: z4.string().optional(),
  unsupportedToolSchemaKeywords: z4.array(z4.string().min(1)).optional(),
  nativeWebSearchTool: z4.boolean().optional(),
  toolCallArgumentsEncoding: z4.string().optional(),
  requiresMistralToolIds: z4.boolean().optional(),
  requiresOpenAiAnthropicToolPayload: z4.boolean().optional()
}).strict().optional();
var ConfiguredProviderRequestTlsSchema = z4.object({
  ca: SecretInputSchema.optional().register(sensitive),
  cert: SecretInputSchema.optional().register(sensitive),
  key: SecretInputSchema.optional().register(sensitive),
  passphrase: SecretInputSchema.optional().register(sensitive),
  serverName: z4.string().optional(),
  insecureSkipVerify: z4.boolean().optional()
}).strict().optional();
var ConfiguredProviderRequestAuthSchema = z4.union([
  z4.object({
    mode: z4.literal("provider-default")
  }).strict(),
  z4.object({
    mode: z4.literal("authorization-bearer"),
    token: SecretInputSchema.register(sensitive)
  }).strict(),
  z4.object({
    mode: z4.literal("header"),
    headerName: z4.string().min(1),
    value: SecretInputSchema.register(sensitive),
    prefix: z4.string().optional()
  }).strict()
]).optional();
var ConfiguredProviderRequestProxySchema = z4.union([
  z4.object({
    mode: z4.literal("env-proxy"),
    tls: ConfiguredProviderRequestTlsSchema
  }).strict(),
  z4.object({
    mode: z4.literal("explicit-proxy"),
    url: z4.string().min(1),
    tls: ConfiguredProviderRequestTlsSchema
  }).strict()
]).optional();
var ConfiguredProviderRequestFields = {
  headers: z4.record(z4.string(), SecretInputSchema.register(sensitive)).optional(),
  auth: ConfiguredProviderRequestAuthSchema,
  proxy: ConfiguredProviderRequestProxySchema,
  tls: ConfiguredProviderRequestTlsSchema
};
var ConfiguredProviderRequestSchema = z4.object(ConfiguredProviderRequestFields).strict().optional();
var ConfiguredModelProviderRequestSchema = z4.object({
  ...ConfiguredProviderRequestFields,
  allowPrivateNetwork: z4.boolean().optional()
}).strict().optional();
var ModelDefinitionSchema = z4.object({
  id: z4.string().min(1),
  name: z4.string().min(1),
  api: ModelApiSchema.optional(),
  baseUrl: z4.string().min(1).optional(),
  reasoning: z4.boolean().optional(),
  input: z4.array(
    z4.union([z4.literal("text"), z4.literal("image"), z4.literal("video"), z4.literal("audio")])
  ).optional(),
  cost: z4.object({
    input: z4.number().optional(),
    output: z4.number().optional(),
    cacheRead: z4.number().optional(),
    cacheWrite: z4.number().optional(),
    tieredPricing: z4.array(
      z4.object({
        input: z4.number(),
        output: z4.number(),
        cacheRead: z4.number(),
        cacheWrite: z4.number(),
        range: z4.union([z4.tuple([z4.number(), z4.number()]), z4.tuple([z4.number()])])
      }).strict()
    ).optional()
  }).strict().optional(),
  contextWindow: z4.number().positive().optional(),
  contextTokens: z4.number().int().positive().optional(),
  maxTokens: z4.number().positive().optional(),
  params: z4.record(z4.string(), z4.unknown()).optional(),
  headers: z4.record(z4.string(), z4.string()).optional(),
  compat: ModelCompatSchema,
  metadataSource: z4.literal("models-add").optional()
}).strict();
var ModelProviderSchema = z4.object({
  baseUrl: z4.string().min(1),
  apiKey: SecretInputSchema.optional().register(sensitive),
  auth: z4.union([z4.literal("api-key"), z4.literal("aws-sdk"), z4.literal("oauth"), z4.literal("token")]).optional(),
  api: ModelApiSchema.optional(),
  contextWindow: z4.number().positive().optional(),
  contextTokens: z4.number().int().positive().optional(),
  maxTokens: z4.number().positive().optional(),
  timeoutSeconds: z4.number().int().positive().optional(),
  injectNumCtxForOpenAICompat: z4.boolean().optional(),
  params: z4.record(z4.string(), z4.unknown()).optional(),
  headers: z4.record(z4.string(), SecretInputSchema.register(sensitive)).optional(),
  authHeader: z4.boolean().optional(),
  request: ConfiguredModelProviderRequestSchema,
  models: z4.array(ModelDefinitionSchema)
}).strict();
var ModelPricingConfigSchema = z4.object({
  enabled: z4.boolean().optional()
}).strict().optional();
var ModelsConfigSchema = z4.object({
  mode: z4.union([z4.literal("merge"), z4.literal("replace")]).optional(),
  providers: z4.record(z4.string(), ModelProviderSchema).optional(),
  pricing: ModelPricingConfigSchema
}).strict().optional();
var VisibleRepliesValueSchema = z4.enum(["automatic", "message_tool"]);
var VisibleRepliesSchema = z4.union([VisibleRepliesValueSchema, z4.boolean()]).overwrite((value) => {
  if (value === true) {
    return "automatic";
  }
  if (value === false) {
    return "message_tool";
  }
  return value;
});
var GroupChatSchema = z4.object({
  mentionPatterns: z4.array(z4.string()).optional(),
  historyLimit: z4.number().int().positive().optional(),
  visibleReplies: VisibleRepliesSchema.optional()
}).strict().optional();
var DmConfigSchema = z4.object({
  historyLimit: z4.number().int().min(0).optional()
}).strict();
var IdentitySchema = z4.object({
  name: z4.string().optional(),
  theme: z4.string().optional(),
  emoji: z4.string().optional(),
  avatar: z4.string().optional()
}).strict().optional();
var QueueModeSchema = z4.union([
  z4.literal("steer"),
  z4.literal("followup"),
  z4.literal("collect"),
  z4.literal("steer-backlog"),
  z4.literal("steer+backlog"),
  z4.literal("queue"),
  z4.literal("interrupt")
]);
var QueueDropSchema = z4.union([z4.literal("old"), z4.literal("new"), z4.literal("summarize")]);
var ReplyToModeSchema = z4.union([
  z4.literal("off"),
  z4.literal("first"),
  z4.literal("all"),
  z4.literal("batched")
]);
var TypingModeSchema = z4.union([
  z4.literal("never"),
  z4.literal("instant"),
  z4.literal("thinking"),
  z4.literal("message")
]);
var GroupPolicySchema = z4.enum(["open", "disabled", "allowlist"]);
var DmPolicySchema = z4.enum(["pairing", "allowlist", "open", "disabled"]);
var ContextVisibilityModeSchema = z4.enum(["all", "allowlist", "allowlist_quote"]);
var BlockStreamingCoalesceSchema = z4.object({
  minChars: z4.number().int().positive().optional(),
  maxChars: z4.number().int().positive().optional(),
  idleMs: z4.number().int().nonnegative().optional()
}).strict();
var ReplyRuntimeConfigSchemaShape = {
  historyLimit: z4.number().int().min(0).optional(),
  dmHistoryLimit: z4.number().int().min(0).optional(),
  contextVisibility: ContextVisibilityModeSchema.optional(),
  dms: z4.record(z4.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: z4.number().int().positive().optional(),
  chunkMode: z4.enum(["length", "newline"]).optional(),
  blockStreaming: z4.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  responsePrefix: z4.string().optional(),
  mediaMaxMb: z4.number().positive().optional()
};
var BlockStreamingChunkSchema = z4.object({
  minChars: z4.number().int().positive().optional(),
  maxChars: z4.number().int().positive().optional(),
  breakPreference: z4.union([z4.literal("paragraph"), z4.literal("newline"), z4.literal("sentence")]).optional()
}).strict();
var MarkdownTableModeSchema = z4.enum(["off", "bullets", "code", "block"]);
var MarkdownConfigSchema = z4.object({
  tables: MarkdownTableModeSchema.optional()
}).strict().optional();
var TtsProviderSchema = z4.string().min(1);
var TtsModeSchema = z4.enum(["final", "all"]);
var TtsAutoSchema = z4.enum(["off", "always", "inbound", "tagged"]);
var TtsProviderConfigSchema = z4.object({
  apiKey: SecretInputSchema.optional().register(sensitive)
}).catchall(
  z4.union([
    z4.string(),
    z4.number(),
    z4.boolean(),
    z4.null(),
    z4.array(z4.unknown()),
    z4.record(z4.string(), z4.unknown())
  ])
);
var TtsPersonaPromptSchema = z4.object({
  profile: z4.string().optional(),
  scene: z4.string().optional(),
  sampleContext: z4.string().optional(),
  style: z4.string().optional(),
  accent: z4.string().optional(),
  pacing: z4.string().optional(),
  constraints: z4.array(z4.string()).optional()
}).strict();
var TtsPersonaSchema = z4.object({
  label: z4.string().optional(),
  description: z4.string().optional(),
  provider: TtsProviderSchema.optional(),
  fallbackPolicy: z4.union([z4.literal("preserve-persona"), z4.literal("provider-defaults"), z4.literal("fail")]).optional(),
  prompt: TtsPersonaPromptSchema.optional(),
  providers: z4.record(z4.string(), TtsProviderConfigSchema).optional()
}).strict();
var TtsConfigSchema = z4.object({
  auto: TtsAutoSchema.optional(),
  enabled: z4.boolean().optional(),
  mode: TtsModeSchema.optional(),
  provider: TtsProviderSchema.optional(),
  persona: z4.string().optional(),
  personas: z4.record(z4.string(), TtsPersonaSchema).optional(),
  summaryModel: z4.string().optional(),
  modelOverrides: z4.object({
    enabled: z4.boolean().optional(),
    allowText: z4.boolean().optional(),
    allowProvider: z4.boolean().optional(),
    allowVoice: z4.boolean().optional(),
    allowModelId: z4.boolean().optional(),
    allowVoiceSettings: z4.boolean().optional(),
    allowNormalization: z4.boolean().optional(),
    allowSeed: z4.boolean().optional()
  }).strict().optional(),
  providers: z4.record(z4.string(), TtsProviderConfigSchema).optional(),
  prefsPath: z4.string().optional(),
  maxTextLength: z4.number().int().min(1).optional(),
  timeoutMs: z4.number().int().min(1e3).max(12e4).optional()
}).strict().optional();
var HumanDelaySchema = z4.object({
  mode: z4.union([z4.literal("off"), z4.literal("natural"), z4.literal("custom")]).optional(),
  minMs: z4.number().int().nonnegative().optional(),
  maxMs: z4.number().int().nonnegative().optional()
}).strict();
var CliBackendWatchdogModeSchema = z4.object({
  noOutputTimeoutMs: z4.number().int().min(1e3).optional(),
  noOutputTimeoutRatio: z4.number().min(0.05).max(0.95).optional(),
  minMs: z4.number().int().min(1e3).optional(),
  maxMs: z4.number().int().min(1e3).optional()
}).strict().optional();
var CliBackendOutputLimitsSchema = z4.object({
  maxTurnRawChars: z4.number().int().min(1024).max(64 * 1024 * 1024).optional(),
  maxTurnLines: z4.number().int().min(100).max(1e5).optional()
}).strict().optional();
var CliBackendSchema = z4.object({
  command: z4.string(),
  args: z4.array(z4.string()).optional(),
  output: z4.union([z4.literal("json"), z4.literal("text"), z4.literal("jsonl")]).optional(),
  resumeOutput: z4.union([z4.literal("json"), z4.literal("text"), z4.literal("jsonl")]).optional(),
  jsonlDialect: z4.literal("claude-stream-json").optional(),
  liveSession: z4.literal("claude-stdio").optional(),
  input: z4.union([z4.literal("arg"), z4.literal("stdin")]).optional(),
  maxPromptArgChars: z4.number().int().positive().optional(),
  env: z4.record(z4.string(), z4.string()).optional(),
  clearEnv: z4.array(z4.string()).optional(),
  modelArg: z4.string().optional(),
  modelAliases: z4.record(z4.string(), z4.string()).optional(),
  sessionArg: z4.string().optional(),
  sessionArgs: z4.array(z4.string()).optional(),
  resumeArgs: z4.array(z4.string()).optional(),
  sessionMode: z4.union([z4.literal("always"), z4.literal("existing"), z4.literal("none")]).optional(),
  sessionIdFields: z4.array(z4.string()).optional(),
  systemPromptArg: z4.string().optional(),
  systemPromptFileArg: z4.string().optional(),
  systemPromptFileConfigArg: z4.string().optional(),
  systemPromptFileConfigKey: z4.string().optional(),
  systemPromptMode: z4.union([z4.literal("append"), z4.literal("replace")]).optional(),
  systemPromptWhen: z4.union([z4.literal("first"), z4.literal("always"), z4.literal("never")]).optional(),
  imageArg: z4.string().optional(),
  imageMode: z4.union([z4.literal("repeat"), z4.literal("list")]).optional(),
  imagePathScope: z4.union([z4.literal("temp"), z4.literal("workspace")]).optional(),
  serialize: z4.boolean().optional(),
  reliability: z4.object({
    outputLimits: CliBackendOutputLimitsSchema,
    watchdog: z4.object({
      fresh: CliBackendWatchdogModeSchema,
      resume: CliBackendWatchdogModeSchema
    }).strict().optional()
  }).strict().optional()
}).strict();
var normalizeAllowFrom = (values) => normalizeStringEntries(values);
var requireOpenAllowFrom = (params) => {
  if (params.policy !== "open") {
    return;
  }
  const allow = normalizeAllowFrom(params.allowFrom);
  if (allow.includes("*")) {
    return;
  }
  params.ctx.addIssue({
    code: z4.ZodIssueCode.custom,
    path: params.path,
    message: params.message
  });
};
var requireAllowlistAllowFrom = (params) => {
  if (params.policy !== "allowlist") {
    return;
  }
  const allow = normalizeAllowFrom(params.allowFrom);
  if (allow.length > 0) {
    return;
  }
  params.ctx.addIssue({
    code: z4.ZodIssueCode.custom,
    path: params.path,
    message: params.message
  });
};
var MSTeamsReplyStyleSchema = z4.enum(["thread", "top-level"]);
var RetryConfigSchema = z4.object({
  attempts: z4.number().int().min(1).optional(),
  minDelayMs: z4.number().int().min(0).optional(),
  maxDelayMs: z4.number().int().min(0).optional(),
  jitter: z4.number().min(0).max(1).optional()
}).strict().optional();
var QueueModeBySurfaceSchema = z4.object({
  whatsapp: QueueModeSchema.optional(),
  telegram: QueueModeSchema.optional(),
  discord: QueueModeSchema.optional(),
  irc: QueueModeSchema.optional(),
  slack: QueueModeSchema.optional(),
  mattermost: QueueModeSchema.optional(),
  signal: QueueModeSchema.optional(),
  imessage: QueueModeSchema.optional(),
  msteams: QueueModeSchema.optional(),
  webchat: QueueModeSchema.optional()
}).strict().optional();
var DebounceMsBySurfaceSchema = z4.record(z4.string(), z4.number().int().nonnegative()).optional();
var QueueSchema = z4.object({
  mode: QueueModeSchema.optional(),
  byChannel: QueueModeBySurfaceSchema,
  debounceMs: z4.number().int().nonnegative().optional(),
  debounceMsByChannel: DebounceMsBySurfaceSchema,
  cap: z4.number().int().positive().optional(),
  drop: QueueDropSchema.optional()
}).strict().optional();
var InboundDebounceSchema = z4.object({
  debounceMs: z4.number().int().nonnegative().optional(),
  byChannel: DebounceMsBySurfaceSchema
}).strict().optional();
var TranscribeAudioSchema = z4.object({
  command: z4.array(z4.string()).superRefine((value, ctx) => {
    const executable = value[0];
    if (!isSafeExecutableValue(executable)) {
      ctx.addIssue({
        code: z4.ZodIssueCode.custom,
        path: [0],
        message: "expected safe executable name or path"
      });
    }
  }),
  timeoutSeconds: z4.number().int().positive().optional()
}).strict().optional();
var HexColorSchema = z4.string().regex(/^#?[0-9a-fA-F]{6}$/, "expected hex color (RRGGBB)");
var ExecutableTokenSchema = z4.string().refine(isSafeExecutableValue, "expected safe executable name or path");
var MediaUnderstandingScopeSchema = createAllowDenyChannelRulesSchema();
var MediaUnderstandingCapabilitiesSchema = z4.array(z4.union([z4.literal("image"), z4.literal("audio"), z4.literal("video")])).optional();
var MediaUnderstandingAttachmentsSchema = z4.object({
  mode: z4.union([z4.literal("first"), z4.literal("all")]).optional(),
  maxAttachments: z4.number().int().positive().optional(),
  prefer: z4.union([z4.literal("first"), z4.literal("last"), z4.literal("path"), z4.literal("url")]).optional()
}).strict().optional();
var DeepgramAudioSchema = z4.object({
  detectLanguage: z4.boolean().optional(),
  punctuate: z4.boolean().optional(),
  smartFormat: z4.boolean().optional()
}).strict().optional();
var ProviderOptionValueSchema = z4.union([z4.string(), z4.number(), z4.boolean()]);
var ProviderOptionsSchema = z4.record(z4.string(), z4.record(z4.string(), ProviderOptionValueSchema)).optional();
var MediaUnderstandingRuntimeFields = {
  prompt: z4.string().optional(),
  timeoutSeconds: z4.number().int().positive().optional(),
  language: z4.string().optional(),
  providerOptions: ProviderOptionsSchema,
  deepgram: DeepgramAudioSchema,
  baseUrl: z4.string().optional(),
  headers: z4.record(z4.string(), z4.string()).optional(),
  request: ConfiguredProviderRequestSchema
};
var MediaUnderstandingModelSchema = z4.object({
  provider: z4.string().optional(),
  model: z4.string().optional(),
  capabilities: MediaUnderstandingCapabilitiesSchema,
  type: z4.union([z4.literal("provider"), z4.literal("cli")]).optional(),
  command: z4.string().optional(),
  args: z4.array(z4.string()).optional(),
  maxChars: z4.number().int().positive().optional(),
  maxBytes: z4.number().int().positive().optional(),
  ...MediaUnderstandingRuntimeFields,
  profile: z4.string().optional(),
  preferredProfile: z4.string().optional()
}).strict().optional();
var ToolsMediaUnderstandingSchema = z4.object({
  enabled: z4.boolean().optional(),
  scope: MediaUnderstandingScopeSchema,
  maxBytes: z4.number().int().positive().optional(),
  maxChars: z4.number().int().positive().optional(),
  ...MediaUnderstandingRuntimeFields,
  attachments: MediaUnderstandingAttachmentsSchema,
  models: z4.array(MediaUnderstandingModelSchema).optional(),
  echoTranscript: z4.boolean().optional(),
  echoFormat: z4.string().optional()
}).strict().optional();
var ToolsMediaSchema = z4.object({
  models: z4.array(MediaUnderstandingModelSchema).optional(),
  concurrency: z4.number().int().positive().optional(),
  asyncCompletion: z4.object({
    directSend: z4.boolean().optional()
  }).strict().optional(),
  image: ToolsMediaUnderstandingSchema.optional(),
  audio: ToolsMediaUnderstandingSchema.optional(),
  video: ToolsMediaUnderstandingSchema.optional()
}).strict().optional();
var LinkModelSchema = z4.object({
  type: z4.literal("cli").optional(),
  command: z4.string().min(1),
  args: z4.array(z4.string()).optional(),
  timeoutSeconds: z4.number().int().positive().optional()
}).strict();
var ToolsLinksSchema = z4.object({
  enabled: z4.boolean().optional(),
  scope: MediaUnderstandingScopeSchema,
  maxLinks: z4.number().int().positive().optional(),
  timeoutSeconds: z4.number().int().positive().optional(),
  models: z4.array(LinkModelSchema).optional()
}).strict().optional();
var NativeCommandsSettingSchema = z4.union([z4.boolean(), z4.literal("auto")]);
var ProviderCommandsSchema = z4.object({
  native: NativeCommandsSettingSchema.optional(),
  nativeSkills: NativeCommandsSettingSchema.optional()
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.agent-runtime.ts
var HeartbeatSchema = z5.object({
  every: z5.string().optional(),
  activeHours: z5.object({
    start: z5.string().optional(),
    end: z5.string().optional(),
    timezone: z5.string().optional()
  }).strict().optional(),
  model: z5.string().optional(),
  session: z5.string().optional(),
  includeReasoning: z5.boolean().optional(),
  target: z5.string().optional(),
  directPolicy: z5.union([z5.literal("allow"), z5.literal("block")]).optional(),
  to: z5.string().optional(),
  accountId: z5.string().optional(),
  prompt: z5.string().optional(),
  includeSystemPromptSection: z5.boolean().optional(),
  ackMaxChars: z5.number().int().nonnegative().optional(),
  suppressToolErrorWarnings: z5.boolean().optional(),
  timeoutSeconds: z5.number().int().positive().optional(),
  lightContext: z5.boolean().optional(),
  isolatedSession: z5.boolean().optional(),
  skipWhenBusy: z5.boolean().optional()
}).strict().superRefine((val, ctx) => {
  if (!val.every) {
    return;
  }
  try {
    parseDurationMs(val.every, { defaultUnit: "m" });
  } catch {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["every"],
      message: "invalid duration (use ms, s, m, h)"
    });
  }
  const active = val.activeHours;
  if (!active) {
    return;
  }
  const timePattern = /^([01]\d|2[0-3]|24):([0-5]\d)$/;
  const validateTime = (raw, opts, path6) => {
    if (!raw) {
      return;
    }
    if (!timePattern.test(raw)) {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["activeHours", path6],
        message: 'invalid time (use "HH:MM" 24h format)'
      });
      return;
    }
    const [hourStr, minuteStr] = raw.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (hour === 24 && minute !== 0) {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["activeHours", path6],
        message: "invalid time (24:00 is the only allowed 24:xx value)"
      });
      return;
    }
    if (hour === 24 && !opts.allow24) {
      ctx.addIssue({
        code: z5.ZodIssueCode.custom,
        path: ["activeHours", path6],
        message: "invalid time (start cannot be 24:00)"
      });
    }
  };
  validateTime(active.start, { allow24: false }, "start");
  validateTime(active.end, { allow24: true }, "end");
}).optional();
var SandboxDockerSchema = z5.object({
  image: z5.string().optional(),
  containerPrefix: z5.string().optional(),
  workdir: z5.string().optional(),
  readOnlyRoot: z5.boolean().optional(),
  tmpfs: z5.array(z5.string()).optional(),
  network: z5.string().optional(),
  user: z5.string().optional(),
  capDrop: z5.array(z5.string()).optional(),
  env: z5.record(z5.string(), z5.string()).optional(),
  setupCommand: z5.union([z5.string(), z5.array(z5.string())]).transform((value) => Array.isArray(value) ? value.join("\n") : value).optional(),
  pidsLimit: z5.number().int().positive().optional(),
  memory: z5.union([z5.string(), z5.number()]).optional(),
  memorySwap: z5.union([z5.string(), z5.number()]).optional(),
  cpus: z5.number().positive().optional(),
  gpus: z5.string().min(1).optional(),
  ulimits: z5.record(
    z5.string(),
    z5.union([
      z5.string(),
      z5.number(),
      z5.object({
        soft: z5.number().int().nonnegative().optional(),
        hard: z5.number().int().nonnegative().optional()
      }).strict()
    ])
  ).optional(),
  seccompProfile: z5.string().optional(),
  apparmorProfile: z5.string().optional(),
  dns: z5.array(z5.string()).optional(),
  extraHosts: z5.array(z5.string()).optional(),
  binds: z5.array(z5.string()).optional(),
  dangerouslyAllowReservedContainerTargets: z5.boolean().optional(),
  dangerouslyAllowExternalBindSources: z5.boolean().optional(),
  dangerouslyAllowContainerNamespaceJoin: z5.boolean().optional()
}).strict().superRefine((data, ctx) => {
  if (data.binds) {
    for (let i = 0; i < data.binds.length; i += 1) {
      const bind = normalizeOptionalString(data.binds[i]) ?? "";
      if (!bind) {
        ctx.addIssue({
          code: z5.ZodIssueCode.custom,
          path: ["binds", i],
          message: "Sandbox security: bind mount entry must be a non-empty string."
        });
        continue;
      }
      const parsed = splitSandboxBindSpec(bind);
      const source = (parsed ? parsed.host : bind).trim();
      if (!isSandboxHostPathAbsolute(source)) {
        ctx.addIssue({
          code: z5.ZodIssueCode.custom,
          path: ["binds", i],
          message: `Sandbox security: bind mount "${bind}" uses a non-absolute source path "${source}". Only absolute POSIX or Windows drive-letter paths are supported for sandbox binds.`
        });
      }
    }
  }
  const blockedNetworkReason = getBlockedNetworkModeReason({
    network: data.network,
    allowContainerNamespaceJoin: data.dangerouslyAllowContainerNamespaceJoin === true
  });
  if (blockedNetworkReason === "host") {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["network"],
      message: 'Sandbox security: network mode "host" is blocked. Use "bridge" or "none" instead.'
    });
  }
  if (blockedNetworkReason === "container_namespace_join") {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["network"],
      message: 'Sandbox security: network mode "container:*" is blocked by default. Use a custom bridge network, or set dangerouslyAllowContainerNamespaceJoin=true only when you fully trust this runtime.'
    });
  }
  if (normalizeLowercaseStringOrEmpty(data.seccompProfile ?? "") === "unconfined") {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["seccompProfile"],
      message: 'Sandbox security: seccomp profile "unconfined" is blocked. Use a custom seccomp profile file or omit this setting.'
    });
  }
  if (normalizeLowercaseStringOrEmpty(data.apparmorProfile ?? "") === "unconfined") {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["apparmorProfile"],
      message: 'Sandbox security: apparmor profile "unconfined" is blocked. Use a named AppArmor profile or omit this setting.'
    });
  }
}).optional();
var SandboxBrowserSchema = z5.object({
  enabled: z5.boolean().optional(),
  image: z5.string().optional(),
  containerPrefix: z5.string().optional(),
  network: z5.string().optional(),
  cdpPort: z5.number().int().positive().optional(),
  cdpSourceRange: z5.string().optional(),
  vncPort: z5.number().int().positive().optional(),
  noVncPort: z5.number().int().positive().optional(),
  headless: z5.boolean().optional(),
  enableNoVnc: z5.boolean().optional(),
  allowHostControl: z5.boolean().optional(),
  autoStart: z5.boolean().optional(),
  autoStartTimeoutMs: z5.number().int().positive().optional(),
  binds: z5.array(z5.string()).optional()
}).superRefine((data, ctx) => {
  if (normalizeLowercaseStringOrEmpty(data.network ?? "") === "host") {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["network"],
      message: 'Sandbox security: browser network mode "host" is blocked. Use "bridge" or a custom bridge network instead.'
    });
  }
}).strict().optional();
var SandboxPruneSchema = z5.object({
  idleHours: z5.number().int().nonnegative().optional(),
  maxAgeDays: z5.number().int().nonnegative().optional()
}).strict().optional();
var AgentContextLimitsSchema = z5.object({
  memoryGetMaxChars: z5.number().int().min(1).max(25e4).optional(),
  memoryGetDefaultLines: z5.number().int().min(1).max(5e3).optional(),
  toolResultMaxChars: z5.number().int().min(1).max(25e4).optional(),
  postCompactionMaxChars: z5.number().int().min(1).max(5e4).optional()
}).strict().optional();
var AgentSkillsLimitsSchema = z5.object({
  maxSkillsPromptChars: z5.number().int().min(0).optional()
}).strict().optional();
var ToolPolicyBaseSchema = z5.object({
  allow: z5.array(z5.string()).optional(),
  alsoAllow: z5.array(z5.string()).optional(),
  deny: z5.array(z5.string()).optional()
}).strict();
var ToolPolicySchema = ToolPolicyBaseSchema.superRefine((value, ctx) => {
  if (value.allow && value.allow.length > 0 && value.alsoAllow && value.alsoAllow.length > 0) {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      message: "tools policy cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)"
    });
  }
}).optional();
var TrimmedOptionalConfigStringSchema = z5.string().transform((value) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : void 0;
}).optional();
var CodexAllowedDomainsSchema = z5.array(z5.string()).transform((values) => {
  const deduped = [
    ...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
  ];
  return deduped.length > 0 ? deduped : void 0;
}).optional();
var CodexUserLocationSchema = z5.object({
  country: TrimmedOptionalConfigStringSchema,
  region: TrimmedOptionalConfigStringSchema,
  city: TrimmedOptionalConfigStringSchema,
  timezone: TrimmedOptionalConfigStringSchema
}).strict().transform((value) => {
  return value.country || value.region || value.city || value.timezone ? value : void 0;
}).optional();
var ToolsWebSearchSchema = z5.object({
  enabled: z5.boolean().optional(),
  provider: z5.string().optional(),
  maxResults: z5.number().int().positive().optional(),
  timeoutSeconds: z5.number().int().positive().optional(),
  cacheTtlMinutes: z5.number().nonnegative().optional(),
  apiKey: SecretInputSchema.optional().register(sensitive),
  openaiCodex: z5.object({
    enabled: z5.boolean().optional(),
    mode: z5.union([z5.literal("cached"), z5.literal("live")]).optional(),
    allowedDomains: CodexAllowedDomainsSchema,
    contextSize: z5.union([z5.literal("low"), z5.literal("medium"), z5.literal("high")]).optional(),
    userLocation: CodexUserLocationSchema
  }).strict().optional()
}).strict().optional();
var ToolsWebFetchSchema = z5.object({
  enabled: z5.boolean().optional(),
  provider: z5.string().optional(),
  maxChars: z5.number().int().positive().optional(),
  maxCharsCap: z5.number().int().positive().optional(),
  maxResponseBytes: z5.number().int().positive().optional(),
  timeoutSeconds: z5.number().int().positive().optional(),
  cacheTtlMinutes: z5.number().nonnegative().optional(),
  maxRedirects: z5.number().int().nonnegative().optional(),
  userAgent: z5.string().optional(),
  readability: z5.boolean().optional(),
  useTrustedEnvProxy: z5.boolean().optional(),
  ssrfPolicy: z5.object({
    allowRfc2544BenchmarkRange: z5.boolean().optional(),
    allowIpv6UniqueLocalRange: z5.boolean().optional()
  }).strict().optional(),
  // Keep the legacy Firecrawl fetch shape loadable so existing installs can
  // start and then migrate cleanly through doctor.
  firecrawl: z5.object({
    enabled: z5.boolean().optional(),
    apiKey: SecretInputSchema.optional().register(sensitive),
    baseUrl: z5.string().optional(),
    onlyMainContent: z5.boolean().optional(),
    maxAgeMs: z5.number().int().nonnegative().optional(),
    timeoutSeconds: z5.number().int().positive().optional()
  }).strict().optional()
}).strict().optional();
var ToolsWebXSearchSchema = z5.object({
  enabled: z5.boolean().optional(),
  model: z5.string().optional(),
  inlineCitations: z5.boolean().optional(),
  maxTurns: z5.number().int().optional(),
  timeoutSeconds: z5.number().int().positive().optional(),
  cacheTtlMinutes: z5.number().nonnegative().optional()
}).strict().optional();
var ToolsWebSchema = z5.object({
  search: ToolsWebSearchSchema,
  fetch: ToolsWebFetchSchema,
  x_search: ToolsWebXSearchSchema
}).strict().optional();
var ToolProfileSchema = z5.union([z5.literal("minimal"), z5.literal("coding"), z5.literal("messaging"), z5.literal("full")]).optional();
function addAllowAlsoAllowConflictIssue(value, ctx, message) {
  if (value.allow && value.allow.length > 0 && value.alsoAllow && value.alsoAllow.length > 0) {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      message
    });
  }
}
var ToolPolicyWithProfileSchema = z5.object({
  allow: z5.array(z5.string()).optional(),
  alsoAllow: z5.array(z5.string()).optional(),
  deny: z5.array(z5.string()).optional(),
  profile: ToolProfileSchema
}).strict().superRefine((value, ctx) => {
  addAllowAlsoAllowConflictIssue(
    value,
    ctx,
    "tools.byProvider policy cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)"
  );
});
var ElevatedAllowFromSchema = z5.record(z5.string(), z5.array(z5.union([z5.string(), z5.number()]))).optional();
var ToolExecApplyPatchSchema = z5.object({
  enabled: z5.boolean().optional(),
  workspaceOnly: z5.boolean().optional(),
  allowModels: z5.array(z5.string()).optional()
}).strict().optional();
var ToolExecSafeBinProfileSchema = z5.object({
  minPositional: z5.number().int().nonnegative().optional(),
  maxPositional: z5.number().int().nonnegative().optional(),
  allowedValueFlags: z5.array(z5.string()).optional(),
  deniedFlags: z5.array(z5.string()).optional()
}).strict();
var ToolExecBaseShape = {
  host: z5.enum(["auto", "sandbox", "gateway", "node"]).optional(),
  security: z5.enum(["deny", "allowlist", "full"]).optional(),
  ask: z5.enum(["off", "on-miss", "always"]).optional(),
  node: z5.string().optional(),
  pathPrepend: z5.array(z5.string()).optional(),
  safeBins: z5.array(z5.string()).optional(),
  strictInlineEval: z5.boolean().optional(),
  safeBinTrustedDirs: z5.array(z5.string()).optional(),
  safeBinProfiles: z5.record(z5.string(), ToolExecSafeBinProfileSchema).optional(),
  backgroundMs: z5.number().int().positive().optional(),
  timeoutSec: z5.number().int().positive().optional(),
  cleanupMs: z5.number().int().positive().optional(),
  notifyOnExit: z5.boolean().optional(),
  notifyOnExitEmptySuccess: z5.boolean().optional(),
  applyPatch: ToolExecApplyPatchSchema
};
var AgentToolExecSchema = z5.object({
  ...ToolExecBaseShape,
  approvalRunningNoticeMs: z5.number().int().nonnegative().optional()
}).strict().optional();
var ToolExecSchema = z5.object(ToolExecBaseShape).strict().optional();
var ToolFsSchema = z5.object({
  workspaceOnly: z5.boolean().optional()
}).strict().optional();
var ToolLoopDetectionDetectorSchema = z5.object({
  genericRepeat: z5.boolean().optional(),
  knownPollNoProgress: z5.boolean().optional(),
  pingPong: z5.boolean().optional()
}).strict().optional();
var ToolLoopPostCompactionGuardSchema = z5.object({
  windowSize: z5.number().int().positive().optional()
}).strict().optional();
var ToolLoopDetectionSchema = z5.object({
  enabled: z5.boolean().optional(),
  historySize: z5.number().int().positive().optional(),
  warningThreshold: z5.number().int().positive().optional(),
  unknownToolThreshold: z5.number().int().positive().optional(),
  criticalThreshold: z5.number().int().positive().optional(),
  globalCircuitBreakerThreshold: z5.number().int().positive().optional(),
  detectors: ToolLoopDetectionDetectorSchema,
  postCompactionGuard: ToolLoopPostCompactionGuardSchema
}).strict().superRefine((value, ctx) => {
  if (value.warningThreshold !== void 0 && value.criticalThreshold !== void 0 && value.warningThreshold >= value.criticalThreshold) {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["criticalThreshold"],
      message: "tools.loopDetection.warningThreshold must be lower than criticalThreshold."
    });
  }
  if (value.criticalThreshold !== void 0 && value.globalCircuitBreakerThreshold !== void 0 && value.criticalThreshold >= value.globalCircuitBreakerThreshold) {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["globalCircuitBreakerThreshold"],
      message: "tools.loopDetection.criticalThreshold must be lower than globalCircuitBreakerThreshold."
    });
  }
}).optional();
var SandboxSshSchema = z5.object({
  target: z5.string().min(1).optional(),
  command: z5.string().min(1).optional(),
  workspaceRoot: z5.string().min(1).optional(),
  strictHostKeyChecking: z5.boolean().optional(),
  updateHostKeys: z5.boolean().optional(),
  identityFile: z5.string().min(1).optional(),
  certificateFile: z5.string().min(1).optional(),
  knownHostsFile: z5.string().min(1).optional(),
  identityData: SecretInputSchema.optional().register(sensitive),
  certificateData: SecretInputSchema.optional().register(sensitive),
  knownHostsData: SecretInputSchema.optional().register(sensitive)
}).strict().optional();
var AgentSandboxSchema = z5.object({
  mode: z5.union([z5.literal("off"), z5.literal("non-main"), z5.literal("all")]).optional(),
  backend: z5.string().min(1).optional(),
  workspaceAccess: z5.union([z5.literal("none"), z5.literal("ro"), z5.literal("rw")]).optional(),
  sessionToolsVisibility: z5.union([z5.literal("spawned"), z5.literal("all")]).optional(),
  scope: z5.union([z5.literal("session"), z5.literal("agent"), z5.literal("shared")]).optional(),
  workspaceRoot: z5.string().optional(),
  docker: SandboxDockerSchema,
  ssh: SandboxSshSchema,
  browser: SandboxBrowserSchema,
  prune: SandboxPruneSchema
}).strict().superRefine((data, ctx) => {
  const blockedBrowserNetworkReason = getBlockedNetworkModeReason({
    network: data.browser?.network,
    allowContainerNamespaceJoin: data.docker?.dangerouslyAllowContainerNamespaceJoin === true
  });
  if (blockedBrowserNetworkReason === "container_namespace_join") {
    ctx.addIssue({
      code: z5.ZodIssueCode.custom,
      path: ["browser", "network"],
      message: 'Sandbox security: browser network mode "container:*" is blocked by default. Set sandbox.docker.dangerouslyAllowContainerNamespaceJoin=true only when you fully trust this runtime.'
    });
  }
}).optional();
var CommonToolPolicyFields = {
  profile: ToolProfileSchema,
  allow: z5.array(z5.string()).optional(),
  alsoAllow: z5.array(z5.string()).optional(),
  deny: z5.array(z5.string()).optional(),
  byProvider: z5.record(z5.string(), ToolPolicyWithProfileSchema).optional()
};
var AgentToolsSchema = z5.object({
  ...CommonToolPolicyFields,
  elevated: z5.object({
    enabled: z5.boolean().optional(),
    allowFrom: ElevatedAllowFromSchema
  }).strict().optional(),
  exec: AgentToolExecSchema,
  fs: ToolFsSchema,
  loopDetection: ToolLoopDetectionSchema,
  sandbox: z5.object({
    tools: ToolPolicySchema
  }).strict().optional()
}).strict().superRefine((value, ctx) => {
  addAllowAlsoAllowConflictIssue(
    value,
    ctx,
    "agent tools cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)"
  );
}).optional();
var MemorySearchSchema = z5.object({
  enabled: z5.boolean().optional(),
  sources: z5.array(z5.union([z5.literal("memory"), z5.literal("sessions")])).optional(),
  extraPaths: z5.array(z5.string()).optional(),
  qmd: z5.object({
    extraCollections: z5.array(
      z5.object({
        path: z5.string(),
        name: z5.string().optional(),
        pattern: z5.string().optional()
      }).strict()
    ).optional()
  }).strict().optional(),
  multimodal: z5.object({
    enabled: z5.boolean().optional(),
    modalities: z5.array(z5.union([z5.literal("image"), z5.literal("audio"), z5.literal("all")])).optional(),
    maxFileBytes: z5.number().int().positive().optional()
  }).strict().optional(),
  experimental: z5.object({
    sessionMemory: z5.boolean().optional()
  }).strict().optional(),
  provider: z5.string().optional(),
  remote: z5.object({
    baseUrl: z5.string().optional(),
    apiKey: SecretInputSchema.optional().register(sensitive),
    headers: z5.record(z5.string(), z5.string()).optional(),
    nonBatchConcurrency: z5.number().int().positive().optional(),
    batch: z5.object({
      enabled: z5.boolean().optional(),
      wait: z5.boolean().optional(),
      concurrency: z5.number().int().positive().optional(),
      pollIntervalMs: z5.number().int().nonnegative().optional(),
      timeoutMinutes: z5.number().int().positive().optional()
    }).strict().optional()
  }).strict().optional(),
  fallback: z5.string().optional(),
  model: z5.string().optional(),
  inputType: z5.string().min(1).optional(),
  queryInputType: z5.string().min(1).optional(),
  documentInputType: z5.string().min(1).optional(),
  outputDimensionality: z5.number().int().positive().optional(),
  local: z5.object({
    modelPath: z5.string().optional(),
    modelCacheDir: z5.string().optional(),
    contextSize: z5.union([z5.number().int().positive(), z5.literal("auto")]).optional()
  }).strict().optional(),
  store: z5.object({
    driver: z5.literal("sqlite").optional(),
    path: z5.string().optional(),
    fts: z5.object({
      tokenizer: z5.union([z5.literal("unicode61"), z5.literal("trigram")]).optional()
    }).strict().optional(),
    vector: z5.object({
      enabled: z5.boolean().optional(),
      extensionPath: z5.string().optional()
    }).strict().optional()
  }).strict().optional(),
  chunking: z5.object({
    tokens: z5.number().int().positive().optional(),
    overlap: z5.number().int().nonnegative().optional()
  }).strict().optional(),
  sync: z5.object({
    onSessionStart: z5.boolean().optional(),
    onSearch: z5.boolean().optional(),
    watch: z5.boolean().optional(),
    watchDebounceMs: z5.number().int().nonnegative().optional(),
    intervalMinutes: z5.number().int().nonnegative().optional(),
    embeddingBatchTimeoutSeconds: z5.number().int().positive().optional(),
    sessions: z5.object({
      deltaBytes: z5.number().int().nonnegative().optional(),
      deltaMessages: z5.number().int().nonnegative().optional(),
      postCompactionForce: z5.boolean().optional()
    }).strict().optional()
  }).strict().optional(),
  query: z5.object({
    maxResults: z5.number().int().positive().optional(),
    minScore: z5.number().min(0).max(1).optional(),
    hybrid: z5.object({
      enabled: z5.boolean().optional(),
      vectorWeight: z5.number().min(0).max(1).optional(),
      textWeight: z5.number().min(0).max(1).optional(),
      candidateMultiplier: z5.number().int().positive().optional(),
      mmr: z5.object({
        enabled: z5.boolean().optional(),
        lambda: z5.number().min(0).max(1).optional()
      }).strict().optional(),
      temporalDecay: z5.object({
        enabled: z5.boolean().optional(),
        halfLifeDays: z5.number().int().positive().optional()
      }).strict().optional()
    }).strict().optional()
  }).strict().optional(),
  cache: z5.object({
    enabled: z5.boolean().optional(),
    maxEntries: z5.number().int().positive().optional()
  }).strict().optional()
}).strict().optional();
var AgentRuntimeAcpSchema = z5.object({
  agent: z5.string().optional(),
  backend: z5.string().optional(),
  mode: z5.enum(["persistent", "oneshot"]).optional(),
  cwd: z5.string().optional()
}).strict().optional();
var AgentRuntimeSchema = z5.union([
  z5.object({
    type: z5.literal("embedded")
  }).strict(),
  z5.object({
    type: z5.literal("acp"),
    acp: AgentRuntimeAcpSchema
  }).strict()
]).optional();
var AgentEmbeddedHarnessSchema = z5.object({
  runtime: z5.string().optional()
}).strict().optional();
var AgentRuntimePolicySchema = z5.object({
  id: z5.string().optional()
}).strict().optional();
var AgentEntrySchema = z5.object({
  id: z5.string(),
  default: z5.boolean().optional(),
  name: z5.string().optional(),
  workspace: z5.string().optional(),
  agentDir: z5.string().optional(),
  systemPromptOverride: z5.string().optional(),
  agentRuntime: AgentRuntimePolicySchema,
  embeddedHarness: AgentEmbeddedHarnessSchema,
  model: AgentModelSchema.optional(),
  thinkingDefault: z5.enum(["off", "minimal", "low", "medium", "high", "xhigh", "adaptive", "max"]).optional(),
  verboseDefault: z5.enum(["off", "on", "full"]).optional(),
  toolProgressDetail: z5.enum(["explain", "raw"]).optional(),
  reasoningDefault: z5.enum(["on", "off", "stream"]).optional(),
  fastModeDefault: z5.boolean().optional(),
  skills: z5.array(z5.string()).optional(),
  memorySearch: MemorySearchSchema,
  humanDelay: HumanDelaySchema.optional(),
  tts: TtsConfigSchema,
  skillsLimits: AgentSkillsLimitsSchema,
  contextLimits: AgentContextLimitsSchema,
  contextTokens: z5.number().int().positive().optional(),
  heartbeat: HeartbeatSchema,
  identity: IdentitySchema,
  groupChat: GroupChatSchema,
  subagents: z5.object({
    allowAgents: z5.array(z5.string()).optional(),
    model: z5.union([
      z5.string(),
      z5.object({
        primary: z5.string().optional(),
        fallbacks: z5.array(z5.string()).optional()
      }).strict()
    ]).optional(),
    thinking: z5.string().optional(),
    requireAgentId: z5.boolean().optional()
  }).strict().optional(),
  embeddedPi: z5.object({
    executionContract: z5.union([z5.literal("default"), z5.literal("strict-agentic")]).optional()
  }).strict().optional(),
  sandbox: AgentSandboxSchema,
  params: z5.record(z5.string(), z5.unknown()).optional(),
  tools: AgentToolsSchema,
  runtime: AgentRuntimeSchema
}).strict();
var ToolsSchema = z5.object({
  ...CommonToolPolicyFields,
  web: ToolsWebSchema,
  media: ToolsMediaSchema,
  links: ToolsLinksSchema,
  sessions: z5.object({
    visibility: z5.enum(["self", "tree", "agent", "all"]).optional()
  }).strict().optional(),
  loopDetection: ToolLoopDetectionSchema,
  message: z5.object({
    allowCrossContextSend: z5.boolean().optional(),
    crossContext: z5.object({
      allowWithinProvider: z5.boolean().optional(),
      allowAcrossProviders: z5.boolean().optional(),
      marker: z5.object({
        enabled: z5.boolean().optional(),
        prefix: z5.string().optional(),
        suffix: z5.string().optional()
      }).strict().optional()
    }).strict().optional(),
    broadcast: z5.object({
      enabled: z5.boolean().optional()
    }).strict().optional()
  }).strict().optional(),
  agentToAgent: z5.object({
    enabled: z5.boolean().optional(),
    allow: z5.array(z5.string()).optional()
  }).strict().optional(),
  elevated: z5.object({
    enabled: z5.boolean().optional(),
    allowFrom: ElevatedAllowFromSchema
  }).strict().optional(),
  exec: ToolExecSchema,
  fs: ToolFsSchema,
  subagents: z5.object({
    tools: ToolPolicySchema
  }).strict().optional(),
  sandbox: z5.object({
    tools: ToolPolicySchema
  }).strict().optional(),
  sessions_spawn: z5.object({
    attachments: z5.object({
      enabled: z5.boolean().optional(),
      maxTotalBytes: z5.number().optional(),
      maxFiles: z5.number().optional(),
      maxFileBytes: z5.number().optional(),
      retainOnSessionKeep: z5.boolean().optional()
    }).strict().optional()
  }).strict().optional(),
  experimental: z5.object({
    planTool: z5.boolean().optional()
  }).strict().optional()
}).strict().superRefine((value, ctx) => {
  addAllowAlsoAllowConflictIssue(
    value,
    ctx,
    "tools cannot set both allow and alsoAllow in the same scope (merge alsoAllow into allow, or remove allow and use profile + alsoAllow)"
  );
}).optional();

// vendor/openclaw/src/config/zod-schema.agent-defaults.ts
var SilentReplyPolicySchema = z6.union([z6.literal("allow"), z6.literal("disallow")]);
var NonNegativeByteSizeSchema = z6.union([
  z6.number().int().nonnegative(),
  z6.string().refine(isValidNonNegativeByteSizeString, "Expected byte size string like 2mb")
]);
var OptionalBootstrapFileNameSchema = z6.enum([
  "SOUL.md",
  "USER.md",
  "HEARTBEAT.md",
  "IDENTITY.md"
]);
var SilentReplyPolicyConfigSchema = z6.object({
  direct: SilentReplyPolicySchema.optional(),
  group: SilentReplyPolicySchema.optional(),
  internal: SilentReplyPolicySchema.optional()
}).strict();
var SilentReplyRewriteConfigSchema = z6.object({
  direct: z6.boolean().optional(),
  group: z6.boolean().optional(),
  internal: z6.boolean().optional()
}).strict();
var AgentDefaultsSchema = z6.object({
  /** Global default provider params applied to all models before per-model and per-agent overrides. */
  params: z6.record(z6.string(), z6.unknown()).optional(),
  agentRuntime: AgentRuntimePolicySchema,
  embeddedHarness: AgentEmbeddedHarnessSchema,
  model: AgentModelSchema.optional(),
  imageModel: AgentModelSchema.optional(),
  imageGenerationModel: AgentModelSchema.optional(),
  videoGenerationModel: AgentModelSchema.optional(),
  musicGenerationModel: AgentModelSchema.optional(),
  mediaGenerationAutoProviderFallback: z6.boolean().optional(),
  pdfModel: AgentModelSchema.optional(),
  pdfMaxBytesMb: z6.number().positive().optional(),
  pdfMaxPages: z6.number().int().positive().optional(),
  models: z6.record(
    z6.string(),
    z6.object({
      alias: z6.string().optional(),
      /** Provider-specific API parameters (e.g., GLM-4.7 thinking mode). */
      params: z6.record(z6.string(), z6.unknown()).optional(),
      /** Enable streaming for this model (default: true, false for Ollama to avoid SDK issue #1205). */
      streaming: z6.boolean().optional()
    }).strict()
  ).optional(),
  workspace: z6.string().optional(),
  skills: z6.array(z6.string()).optional(),
  silentReply: SilentReplyPolicyConfigSchema.optional(),
  silentReplyRewrite: SilentReplyRewriteConfigSchema.optional(),
  repoRoot: z6.string().optional(),
  systemPromptOverride: z6.string().optional(),
  promptOverlays: z6.object({
    gpt5: z6.object({
      personality: z6.union([z6.literal("friendly"), z6.literal("on"), z6.literal("off")]).optional()
    }).strict().optional()
  }).strict().optional(),
  skipBootstrap: z6.boolean().optional(),
  skipOptionalBootstrapFiles: z6.array(OptionalBootstrapFileNameSchema).optional(),
  contextInjection: z6.union([z6.literal("always"), z6.literal("continuation-skip"), z6.literal("never")]).optional(),
  bootstrapMaxChars: z6.number().int().positive().optional(),
  bootstrapTotalMaxChars: z6.number().int().positive().optional(),
  experimental: z6.object({
    localModelLean: z6.boolean().optional()
  }).strict().optional(),
  bootstrapPromptTruncationWarning: z6.union([z6.literal("off"), z6.literal("once"), z6.literal("always")]).optional(),
  userTimezone: z6.string().optional(),
  startupContext: z6.object({
    enabled: z6.boolean().optional(),
    applyOn: z6.array(z6.union([z6.literal("new"), z6.literal("reset")])).optional(),
    dailyMemoryDays: z6.number().int().min(1).max(14).optional(),
    maxFileBytes: z6.number().int().min(1).max(64 * 1024).optional(),
    maxFileChars: z6.number().int().min(1).max(1e4).optional(),
    maxTotalChars: z6.number().int().min(1).max(5e4).optional()
  }).strict().optional(),
  contextLimits: AgentContextLimitsSchema,
  timeFormat: z6.union([z6.literal("auto"), z6.literal("12"), z6.literal("24")]).optional(),
  envelopeTimezone: z6.string().optional(),
  envelopeTimestamp: z6.union([z6.literal("on"), z6.literal("off")]).optional(),
  envelopeElapsed: z6.union([z6.literal("on"), z6.literal("off")]).optional(),
  contextTokens: z6.number().int().positive().optional(),
  cliBackends: z6.record(z6.string(), CliBackendSchema).optional(),
  memorySearch: MemorySearchSchema,
  contextPruning: z6.object({
    mode: z6.union([z6.literal("off"), z6.literal("cache-ttl")]).optional(),
    ttl: z6.string().optional(),
    keepLastAssistants: z6.number().int().nonnegative().optional(),
    softTrimRatio: z6.number().min(0).max(1).optional(),
    hardClearRatio: z6.number().min(0).max(1).optional(),
    minPrunableToolChars: z6.number().int().nonnegative().optional(),
    tools: z6.object({
      allow: z6.array(z6.string()).optional(),
      deny: z6.array(z6.string()).optional()
    }).strict().optional(),
    softTrim: z6.object({
      maxChars: z6.number().int().nonnegative().optional(),
      headChars: z6.number().int().nonnegative().optional(),
      tailChars: z6.number().int().nonnegative().optional()
    }).strict().optional(),
    hardClear: z6.object({
      enabled: z6.boolean().optional(),
      placeholder: z6.string().optional()
    }).strict().optional()
  }).strict().optional(),
  compaction: z6.object({
    mode: z6.union([z6.literal("default"), z6.literal("safeguard")]).optional(),
    provider: z6.string().optional(),
    reserveTokens: z6.number().int().nonnegative().optional(),
    keepRecentTokens: z6.number().int().positive().optional(),
    reserveTokensFloor: z6.number().int().nonnegative().optional(),
    maxHistoryShare: z6.number().min(0.1).max(0.9).optional(),
    customInstructions: z6.string().optional(),
    identifierPolicy: z6.union([z6.literal("strict"), z6.literal("off"), z6.literal("custom")]).optional(),
    identifierInstructions: z6.string().optional(),
    recentTurnsPreserve: z6.number().int().min(0).max(12).optional(),
    qualityGuard: z6.object({
      enabled: z6.boolean().optional(),
      maxRetries: z6.number().int().nonnegative().optional()
    }).strict().optional(),
    midTurnPrecheck: z6.object({
      enabled: z6.boolean().optional()
    }).strict().optional(),
    postIndexSync: z6.enum(["off", "async", "await"]).optional(),
    postCompactionSections: z6.array(z6.string()).optional(),
    model: z6.string().optional(),
    timeoutSeconds: z6.number().int().positive().optional(),
    memoryFlush: z6.object({
      enabled: z6.boolean().optional(),
      model: z6.string().optional(),
      softThresholdTokens: z6.number().int().nonnegative().optional(),
      forceFlushTranscriptBytes: NonNegativeByteSizeSchema.optional(),
      prompt: z6.string().optional(),
      systemPrompt: z6.string().optional()
    }).strict().optional(),
    truncateAfterCompaction: z6.boolean().optional(),
    maxActiveTranscriptBytes: NonNegativeByteSizeSchema.optional(),
    notifyUser: z6.boolean().optional()
  }).strict().optional(),
  embeddedPi: z6.object({
    projectSettingsPolicy: z6.union([z6.literal("trusted"), z6.literal("sanitize"), z6.literal("ignore")]).optional(),
    executionContract: z6.union([z6.literal("default"), z6.literal("strict-agentic")]).optional()
  }).strict().optional(),
  thinkingDefault: z6.union([
    z6.literal("off"),
    z6.literal("minimal"),
    z6.literal("low"),
    z6.literal("medium"),
    z6.literal("high"),
    z6.literal("xhigh"),
    z6.literal("adaptive"),
    z6.literal("max")
  ]).optional(),
  verboseDefault: z6.union([z6.literal("off"), z6.literal("on"), z6.literal("full")]).optional(),
  toolProgressDetail: z6.union([z6.literal("explain"), z6.literal("raw")]).optional(),
  reasoningDefault: z6.union([z6.literal("off"), z6.literal("on"), z6.literal("stream")]).optional(),
  elevatedDefault: z6.union([z6.literal("off"), z6.literal("on"), z6.literal("ask"), z6.literal("full")]).optional(),
  blockStreamingDefault: z6.union([z6.literal("off"), z6.literal("on")]).optional(),
  blockStreamingBreak: z6.union([z6.literal("text_end"), z6.literal("message_end")]).optional(),
  blockStreamingChunk: BlockStreamingChunkSchema.optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  humanDelay: HumanDelaySchema.optional(),
  timeoutSeconds: z6.number().int().positive().optional(),
  mediaMaxMb: z6.number().positive().optional(),
  imageMaxDimensionPx: z6.number().int().positive().optional(),
  typingIntervalSeconds: z6.number().int().positive().optional(),
  typingMode: TypingModeSchema.optional(),
  heartbeat: HeartbeatSchema,
  maxConcurrent: z6.number().int().positive().optional(),
  subagents: z6.object({
    allowAgents: z6.array(z6.string()).optional(),
    maxConcurrent: z6.number().int().positive().optional(),
    maxSpawnDepth: z6.number().int().min(1).max(5).optional().describe(
      "Maximum nesting depth for sub-agent spawning. 1 = no nesting (default), 2 = sub-agents can spawn sub-sub-agents."
    ),
    maxChildrenPerAgent: z6.number().int().min(1).max(20).optional().describe(
      "Maximum number of active children a single agent session can spawn (default: 5)."
    ),
    archiveAfterMinutes: z6.number().int().min(0).optional(),
    model: AgentModelSchema.optional(),
    thinking: z6.string().optional(),
    runTimeoutSeconds: z6.number().int().min(0).optional(),
    announceTimeoutMs: z6.number().int().positive().optional(),
    requireAgentId: z6.boolean().optional()
  }).strict().optional(),
  sandbox: AgentSandboxSchema
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.agents.ts
import { z as z7 } from "zod";
var AgentsSchema = z7.object({
  defaults: z7.lazy(() => AgentDefaultsSchema).optional(),
  list: z7.array(AgentEntrySchema).optional()
}).strict().optional();
var BindingMatchSchema = z7.object({
  channel: z7.string(),
  accountId: z7.string().optional(),
  peer: z7.object({
    kind: z7.union([
      z7.literal("direct"),
      z7.literal("group"),
      z7.literal("channel"),
      /** @deprecated Use `direct` instead. Kept for backward compatibility. */
      z7.literal("dm")
    ]),
    id: z7.string()
  }).strict().optional(),
  guildId: z7.string().optional(),
  teamId: z7.string().optional(),
  roles: z7.array(z7.string()).optional()
}).strict();
var BindingSessionSchema = z7.object({
  dmScope: z7.union([
    z7.literal("main"),
    z7.literal("per-peer"),
    z7.literal("per-channel-peer"),
    z7.literal("per-account-channel-peer")
  ]).optional()
}).strict();
var RouteBindingSchema = z7.object({
  type: z7.literal("route").optional(),
  agentId: z7.string(),
  comment: z7.string().optional(),
  match: BindingMatchSchema,
  session: BindingSessionSchema.optional()
}).strict();
var AcpBindingSchema = z7.object({
  type: z7.literal("acp"),
  agentId: z7.string(),
  comment: z7.string().optional(),
  match: BindingMatchSchema,
  acp: z7.object({
    mode: z7.enum(["persistent", "oneshot"]).optional(),
    label: z7.string().optional(),
    cwd: z7.string().optional(),
    backend: z7.string().optional()
  }).strict().optional()
}).strict().superRefine((value, ctx) => {
  const peerId = normalizeOptionalString(value.match.peer?.id) ?? "";
  if (!peerId) {
    ctx.addIssue({
      code: z7.ZodIssueCode.custom,
      path: ["match", "peer"],
      message: "ACP bindings require match.peer.id to target a concrete conversation."
    });
    return;
  }
});
var BindingsSchema = z7.array(z7.union([RouteBindingSchema, AcpBindingSchema])).optional();
var BroadcastStrategySchema = z7.enum(["parallel", "sequential"]);
var BroadcastSchema = z7.object({
  strategy: BroadcastStrategySchema.optional()
}).catchall(z7.array(z7.string())).optional();
var AudioSchema = z7.object({
  transcription: TranscribeAudioSchema
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.approvals.ts
import { z as z8 } from "zod";
var ExecApprovalForwardTargetSchema = z8.object({
  channel: z8.string().min(1),
  to: z8.string().min(1),
  accountId: z8.string().optional(),
  threadId: z8.union([z8.string(), z8.number()]).optional()
}).strict();
var ExecApprovalForwardingSchema = z8.object({
  enabled: z8.boolean().optional(),
  mode: z8.union([z8.literal("session"), z8.literal("targets"), z8.literal("both")]).optional(),
  agentFilter: z8.array(z8.string()).optional(),
  sessionFilter: z8.array(z8.string()).optional(),
  targets: z8.array(ExecApprovalForwardTargetSchema).optional()
}).strict().optional();
var ApprovalsSchema = z8.object({
  exec: ExecApprovalForwardingSchema,
  plugin: ExecApprovalForwardingSchema
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.hooks.ts
import path4 from "node:path";
import { z as z10 } from "zod";

// vendor/openclaw/src/config/zod-schema.installs.ts
import { z as z9 } from "zod";
var InstallSourceSchema = z9.union([
  z9.literal("npm"),
  z9.literal("archive"),
  z9.literal("path"),
  z9.literal("clawhub"),
  z9.literal("git")
]);
var PluginInstallSourceSchema = z9.union([InstallSourceSchema, z9.literal("marketplace")]);
var InstallRecordShape = {
  source: InstallSourceSchema,
  spec: z9.string().optional(),
  sourcePath: z9.string().optional(),
  installPath: z9.string().optional(),
  version: z9.string().optional(),
  resolvedName: z9.string().optional(),
  resolvedVersion: z9.string().optional(),
  resolvedSpec: z9.string().optional(),
  integrity: z9.string().optional(),
  shasum: z9.string().optional(),
  resolvedAt: z9.string().optional(),
  installedAt: z9.string().optional(),
  clawhubUrl: z9.string().optional(),
  clawhubPackage: z9.string().optional(),
  clawhubFamily: z9.union([z9.literal("code-plugin"), z9.literal("bundle-plugin")]).optional(),
  clawhubChannel: z9.union([z9.literal("official"), z9.literal("community"), z9.literal("private")]).optional(),
  artifactKind: z9.union([z9.literal("legacy-zip"), z9.literal("npm-pack")]).optional(),
  artifactFormat: z9.union([z9.literal("zip"), z9.literal("tgz")]).optional(),
  npmIntegrity: z9.string().optional(),
  npmShasum: z9.string().optional(),
  npmTarballName: z9.string().optional(),
  clawpackSha256: z9.string().optional(),
  clawpackSpecVersion: z9.number().int().nonnegative().optional(),
  clawpackManifestSha256: z9.string().optional(),
  clawpackSize: z9.number().int().nonnegative().optional(),
  gitUrl: z9.string().optional(),
  gitRef: z9.string().optional(),
  gitCommit: z9.string().optional()
};
var PluginInstallRecordShape = {
  ...InstallRecordShape,
  source: PluginInstallSourceSchema,
  marketplaceName: z9.string().optional(),
  marketplaceSource: z9.string().optional(),
  marketplacePlugin: z9.string().optional()
};

// vendor/openclaw/src/config/zod-schema.hooks.ts
function isSafeRelativeModulePath(raw) {
  const value = raw.trim();
  if (!value) {
    return false;
  }
  if (path4.isAbsolute(value)) {
    return false;
  }
  if (value.startsWith("~")) {
    return false;
  }
  if (value.includes(":")) {
    return false;
  }
  const parts = value.split(/[\\/]+/g);
  if (parts.some((part) => part === "..")) {
    return false;
  }
  return true;
}
var SafeRelativeModulePathSchema = z10.string().refine(isSafeRelativeModulePath, "module must be a safe relative path (no absolute paths)");
var HookMappingSchema = z10.object({
  id: z10.string().optional(),
  match: z10.object({
    path: z10.string().optional(),
    source: z10.string().optional()
  }).optional(),
  action: z10.union([z10.literal("wake"), z10.literal("agent")]).optional(),
  wakeMode: z10.union([z10.literal("now"), z10.literal("next-heartbeat")]).optional(),
  name: z10.string().optional(),
  agentId: z10.string().optional(),
  sessionKey: z10.string().optional().register(sensitive),
  messageTemplate: z10.string().optional(),
  textTemplate: z10.string().optional(),
  deliver: z10.boolean().optional(),
  allowUnsafeExternalContent: z10.boolean().optional(),
  // Keep this open-ended so runtime channel plugins (for example feishu) can be
  // referenced without hard-coding every channel id in the config schema.
  // Runtime still validates the resolved value against currently registered channels.
  channel: z10.string().trim().min(1).optional(),
  to: z10.string().optional(),
  model: z10.string().optional(),
  thinking: z10.string().optional(),
  timeoutSeconds: z10.number().int().positive().optional(),
  transform: z10.object({
    module: SafeRelativeModulePathSchema,
    export: z10.string().optional()
  }).strict().optional()
}).strict().optional();
var InternalHookHandlerSchema = z10.object({
  event: z10.string(),
  module: SafeRelativeModulePathSchema,
  export: z10.string().optional()
}).strict();
var HookConfigSchema = z10.object({
  enabled: z10.boolean().optional(),
  env: z10.record(z10.string(), z10.string()).optional()
}).passthrough();
var HookInstallRecordSchema = z10.object({
  ...InstallRecordShape,
  hooks: z10.array(z10.string()).optional()
}).strict();
var InternalHooksSchema = z10.object({
  enabled: z10.boolean().optional(),
  handlers: z10.array(InternalHookHandlerSchema).optional(),
  entries: z10.record(z10.string(), HookConfigSchema).optional(),
  load: z10.object({
    extraDirs: z10.array(z10.string()).optional()
  }).strict().optional(),
  installs: z10.record(z10.string(), HookInstallRecordSchema).optional()
}).strict().optional();
var HooksGmailSchema = z10.object({
  account: z10.string().optional(),
  label: z10.string().optional(),
  topic: z10.string().optional(),
  subscription: z10.string().optional(),
  pushToken: z10.string().optional().register(sensitive),
  hookUrl: z10.string().optional(),
  includeBody: z10.boolean().optional(),
  maxBytes: z10.number().int().positive().optional(),
  renewEveryMinutes: z10.number().int().positive().optional(),
  allowUnsafeExternalContent: z10.boolean().optional(),
  serve: z10.object({
    bind: z10.string().optional(),
    port: z10.number().int().positive().optional(),
    path: z10.string().optional()
  }).strict().optional(),
  tailscale: z10.object({
    mode: z10.union([z10.literal("off"), z10.literal("serve"), z10.literal("funnel")]).optional(),
    path: z10.string().optional(),
    target: z10.string().optional()
  }).strict().optional(),
  model: z10.string().optional(),
  thinking: z10.union([
    z10.literal("off"),
    z10.literal("minimal"),
    z10.literal("low"),
    z10.literal("medium"),
    z10.literal("high")
  ]).optional()
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.providers.ts
import { z as z15 } from "zod";

// vendor/openclaw/src/config/zod-schema.channels.ts
import { z as z11 } from "zod";
var ChannelHeartbeatVisibilitySchema = z11.object({
  showOk: z11.boolean().optional(),
  showAlerts: z11.boolean().optional(),
  useIndicator: z11.boolean().optional()
}).strict().optional();
var ChannelHealthMonitorSchema = z11.object({
  enabled: z11.boolean().optional()
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.providers-core.ts
import { z as z13 } from "zod";

// vendor/openclaw/src/infra/scp-host.ts
var SSH_TOKEN = /^[A-Za-z0-9._-]+$/;
var BRACKETED_IPV6 = /^\[[0-9A-Fa-f:.%]+\]$/;
var WHITESPACE = /\s/;
function hasControlOrWhitespace(value) {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127 || WHITESPACE.test(char)) {
      return true;
    }
  }
  return false;
}
function normalizeScpRemoteHost(value) {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) {
    return void 0;
  }
  if (hasControlOrWhitespace(trimmed)) {
    return void 0;
  }
  if (trimmed.startsWith("-") || trimmed.includes("/") || trimmed.includes("\\")) {
    return void 0;
  }
  const firstAt = trimmed.indexOf("@");
  const lastAt = trimmed.lastIndexOf("@");
  let user;
  let host = trimmed;
  if (firstAt !== -1) {
    if (firstAt !== lastAt || firstAt === 0 || firstAt === trimmed.length - 1) {
      return void 0;
    }
    user = trimmed.slice(0, firstAt);
    host = trimmed.slice(firstAt + 1);
    if (!SSH_TOKEN.test(user)) {
      return void 0;
    }
  }
  if (!host || host.startsWith("-") || host.includes("@")) {
    return void 0;
  }
  if (host.includes(":") && !BRACKETED_IPV6.test(host)) {
    return void 0;
  }
  if (!SSH_TOKEN.test(host) && !BRACKETED_IPV6.test(host)) {
    return void 0;
  }
  return user ? `${user}@${host}` : host;
}
function isSafeScpRemoteHost(value) {
  return normalizeScpRemoteHost(value) !== void 0;
}

// vendor/openclaw/src/media/inbound-path-policy.ts
import path5 from "node:path";
var WILDCARD_SEGMENT = "*";
var WINDOWS_DRIVE_ABS_RE = /^[A-Za-z]:\//;
var WINDOWS_DRIVE_ROOT_RE = /^[A-Za-z]:$/;
function normalizePosixAbsolutePath(value) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("\0")) {
    return void 0;
  }
  const normalized = path5.posix.normalize(trimmed.replaceAll("\\", "/"));
  const isAbsolute = normalized.startsWith("/") || WINDOWS_DRIVE_ABS_RE.test(normalized);
  if (!isAbsolute || normalized === "/") {
    return void 0;
  }
  const withoutTrailingSlash = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  if (WINDOWS_DRIVE_ROOT_RE.test(withoutTrailingSlash)) {
    return void 0;
  }
  return withoutTrailingSlash;
}
function splitPathSegments(value) {
  return value.split("/").filter(Boolean);
}
function isValidInboundPathRootPattern(value) {
  const normalized = normalizePosixAbsolutePath(value);
  if (!normalized) {
    return false;
  }
  const segments = splitPathSegments(normalized);
  if (segments.length === 0) {
    return false;
  }
  return segments.every((segment) => segment === WILDCARD_SEGMENT || !segment.includes("*"));
}

// vendor/openclaw/src/shared/custom-command-config.ts
var DEFAULT_PREFIX = "/";
function normalizeSlashCommandName(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const withoutSlash = trimmed.startsWith(DEFAULT_PREFIX) ? trimmed.slice(1) : trimmed;
  return normalizeLowercaseStringOrEmpty(withoutSlash).replace(/-/g, "_");
}
function normalizeCommandDescription(value) {
  return value.trim();
}
function resolveCustomCommands(params) {
  const entries = Array.isArray(params.commands) ? params.commands : [];
  const reserved = params.reservedCommands ?? /* @__PURE__ */ new Set();
  const checkReserved = params.checkReserved !== false;
  const checkDuplicates = params.checkDuplicates !== false;
  const seen = /* @__PURE__ */ new Set();
  const resolved = [];
  const issues = [];
  const label = params.config.label;
  const prefix = params.config.prefix ?? DEFAULT_PREFIX;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const normalized = normalizeSlashCommandName(entry?.command ?? "");
    if (!normalized) {
      issues.push({
        index,
        field: "command",
        message: `${label} custom command is missing a command name.`
      });
      continue;
    }
    if (!params.config.pattern.test(normalized)) {
      issues.push({
        index,
        field: "command",
        message: `${label} custom command "${prefix}${normalized}" is invalid (${params.config.patternDescription}).`
      });
      continue;
    }
    if (checkReserved && reserved.has(normalized)) {
      issues.push({
        index,
        field: "command",
        message: `${label} custom command "${prefix}${normalized}" conflicts with a native command.`
      });
      continue;
    }
    if (checkDuplicates && seen.has(normalized)) {
      issues.push({
        index,
        field: "command",
        message: `${label} custom command "${prefix}${normalized}" is duplicated.`
      });
      continue;
    }
    const description = normalizeCommandDescription(entry?.description ?? "");
    if (!description) {
      issues.push({
        index,
        field: "description",
        message: `${label} custom command "${prefix}${normalized}" is missing a description.`
      });
      continue;
    }
    if (checkDuplicates) {
      seen.add(normalized);
    }
    resolved.push({ command: normalized, description });
  }
  return { commands: resolved, issues };
}

// vendor/openclaw/src/config/zod-schema.secret-input-validation.ts
import { z as z12 } from "zod";
function forEachEnabledAccount(accounts, run) {
  if (!accounts) {
    return;
  }
  for (const [accountId, account] of Object.entries(accounts)) {
    if (!account || account.enabled === false) {
      continue;
    }
    run(accountId, account);
  }
}
function validateTelegramWebhookSecretRequirements(value, ctx) {
  const baseWebhookUrl = normalizeOptionalString(value.webhookUrl) ?? "";
  const hasBaseWebhookSecret = hasConfiguredSecretInput(value.webhookSecret);
  if (baseWebhookUrl && !hasBaseWebhookSecret) {
    ctx.addIssue({
      code: z12.ZodIssueCode.custom,
      message: "channels.telegram.webhookUrl requires channels.telegram.webhookSecret",
      path: ["webhookSecret"]
    });
  }
  forEachEnabledAccount(value.accounts, (accountId, account) => {
    const accountWebhookUrl = normalizeOptionalString(account.webhookUrl) ?? "";
    if (!accountWebhookUrl) {
      return;
    }
    const hasAccountSecret = hasConfiguredSecretInput(account.webhookSecret);
    if (!hasAccountSecret && !hasBaseWebhookSecret) {
      ctx.addIssue({
        code: z12.ZodIssueCode.custom,
        message: "channels.telegram.accounts.*.webhookUrl requires channels.telegram.webhookSecret or channels.telegram.accounts.*.webhookSecret",
        path: ["accounts", accountId, "webhookSecret"]
      });
    }
  });
}
function validateSlackSigningSecretRequirements(value, ctx) {
  const baseMode = value.mode === "http" || value.mode === "socket" ? value.mode : "socket";
  if (baseMode === "http" && !hasConfiguredSecretInput(value.signingSecret)) {
    ctx.addIssue({
      code: z12.ZodIssueCode.custom,
      message: 'channels.slack.mode="http" requires channels.slack.signingSecret',
      path: ["signingSecret"]
    });
  }
  forEachEnabledAccount(value.accounts, (accountId, account) => {
    const accountMode = account.mode === "http" || account.mode === "socket" ? account.mode : baseMode;
    if (accountMode !== "http") {
      return;
    }
    const accountSecret = account.signingSecret ?? value.signingSecret;
    if (!hasConfiguredSecretInput(accountSecret)) {
      ctx.addIssue({
        code: z12.ZodIssueCode.custom,
        message: 'channels.slack.accounts.*.mode="http" requires channels.slack.signingSecret or channels.slack.accounts.*.signingSecret',
        path: ["accounts", accountId, "signingSecret"]
      });
    }
  });
}

// vendor/openclaw/src/config/zod-schema.providers-core.ts
var ToolPolicyBySenderSchema = z13.record(z13.string(), ToolPolicySchema).optional();
var DiscordIdSchema = z13.union([z13.string(), z13.number()]).transform((value, ctx) => {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      ctx.addIssue({
        code: z13.ZodIssueCode.custom,
        message: `Discord ID "${String(value)}" is not a valid non-negative safe integer. Wrap it in quotes in your config file.`
      });
      return z13.NEVER;
    }
    return String(value);
  }
  return value;
}).pipe(z13.string());
var DiscordIdListSchema = z13.array(DiscordIdSchema);
var DiscordSnowflakeStringSchema = z13.string().regex(/^\d+$/, "Discord user ID must be numeric");
var TelegramInlineButtonsScopeSchema = z13.enum(["off", "dm", "group", "all", "allowlist"]);
var TelegramIdListSchema = z13.array(z13.union([z13.string(), z13.number()]));
var TelegramCapabilitiesSchema = z13.union([
  z13.array(z13.string()),
  z13.object({
    inlineButtons: TelegramInlineButtonsScopeSchema.optional()
  }).strict()
]);
var TextChunkModeSchema = z13.enum(["length", "newline"]);
var UnifiedStreamingModeSchema = z13.enum(["off", "partial", "block", "progress"]);
var ChannelStreamingBlockSchema = z13.object({
  enabled: z13.boolean().optional(),
  coalesce: BlockStreamingCoalesceSchema.optional()
}).strict();
var ChannelStreamingPreviewSchema = z13.object({
  chunk: BlockStreamingChunkSchema.optional(),
  toolProgress: z13.boolean().optional(),
  commandText: z13.enum(["raw", "status"]).optional()
}).strict();
var ChannelStreamingProgressSchema = z13.object({
  label: z13.union([z13.string(), z13.literal(false)]).optional(),
  labels: z13.array(z13.string()).optional(),
  maxLines: z13.number().int().positive().optional(),
  render: z13.enum(["text", "rich"]).optional(),
  toolProgress: z13.boolean().optional(),
  commandText: z13.enum(["raw", "status"]).optional()
}).strict();
var ChannelPreviewStreamingConfigSchema = z13.object({
  mode: UnifiedStreamingModeSchema.optional(),
  chunkMode: TextChunkModeSchema.optional(),
  preview: ChannelStreamingPreviewSchema.optional(),
  progress: ChannelStreamingProgressSchema.optional(),
  block: ChannelStreamingBlockSchema.optional()
}).strict();
var SlackStreamingConfigSchema = ChannelPreviewStreamingConfigSchema.extend({
  nativeTransport: z13.boolean().optional()
}).strict();
var SlackCapabilitiesSchema = z13.union([
  z13.array(z13.string()),
  z13.object({
    interactiveReplies: z13.boolean().optional()
  }).strict()
]);
var TelegramErrorPolicySchema = z13.enum(["always", "once", "silent"]).optional();
var TelegramCommandNamePattern = /^[a-z0-9_]{1,32}$/;
var TelegramCustomCommandConfig = {
  label: "Telegram",
  pattern: TelegramCommandNamePattern,
  patternDescription: "use a-z, 0-9, underscore; max 32 chars"
};
var TelegramTopicSchema = z13.object({
  requireMention: z13.boolean().optional(),
  ingest: z13.boolean().optional(),
  disableAudioPreflight: z13.boolean().optional(),
  groupPolicy: GroupPolicySchema.optional(),
  skills: z13.array(z13.string()).optional(),
  enabled: z13.boolean().optional(),
  allowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  systemPrompt: z13.string().optional(),
  agentId: z13.string().optional(),
  errorPolicy: TelegramErrorPolicySchema,
  errorCooldownMs: z13.number().int().nonnegative().optional()
}).strict();
var TelegramGroupSchema = z13.object({
  requireMention: z13.boolean().optional(),
  ingest: z13.boolean().optional(),
  disableAudioPreflight: z13.boolean().optional(),
  groupPolicy: GroupPolicySchema.optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema,
  skills: z13.array(z13.string()).optional(),
  enabled: z13.boolean().optional(),
  allowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  systemPrompt: z13.string().optional(),
  topics: z13.record(z13.string(), TelegramTopicSchema.optional()).optional(),
  errorPolicy: TelegramErrorPolicySchema,
  errorCooldownMs: z13.number().int().nonnegative().optional()
}).strict();
var TelegramDmThreadRepliesSchema = z13.enum(["off", "inbound", "always"]);
var TelegramDmSchema = z13.object({
  threadReplies: TelegramDmThreadRepliesSchema.optional()
}).strict();
var AutoTopicLabelSchema = z13.union([
  z13.boolean(),
  z13.object({
    enabled: z13.boolean().optional(),
    prompt: z13.string().optional()
  }).strict()
]).optional();
var TelegramDirectSchema = z13.object({
  dmPolicy: DmPolicySchema.optional(),
  threadReplies: z13.enum(["off", "inbound", "always"]).optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema,
  skills: z13.array(z13.string()).optional(),
  enabled: z13.boolean().optional(),
  allowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  systemPrompt: z13.string().optional(),
  topics: z13.record(z13.string(), TelegramTopicSchema.optional()).optional(),
  errorPolicy: TelegramErrorPolicySchema,
  errorCooldownMs: z13.number().int().nonnegative().optional(),
  requireTopic: z13.boolean().optional(),
  autoTopicLabel: AutoTopicLabelSchema
}).strict();
var TelegramCustomCommandSchema = z13.object({
  command: z13.string().overwrite(normalizeSlashCommandName),
  description: z13.string().overwrite(normalizeCommandDescription)
}).strict();
var validateTelegramCustomCommands = (value, ctx) => {
  if (!value.customCommands || value.customCommands.length === 0) {
    return;
  }
  const { issues } = resolveCustomCommands({
    commands: value.customCommands,
    checkReserved: false,
    checkDuplicates: false,
    config: TelegramCustomCommandConfig
  });
  for (const issue of issues) {
    ctx.addIssue({
      code: z13.ZodIssueCode.custom,
      path: ["customCommands", issue.index, issue.field],
      message: issue.message
    });
  }
};
var TelegramAccountSchemaBase = z13.object({
  name: z13.string().optional(),
  capabilities: TelegramCapabilitiesSchema.optional(),
  execApprovals: z13.object({
    enabled: z13.boolean().optional(),
    approvers: TelegramIdListSchema.optional(),
    agentFilter: z13.array(z13.string()).optional(),
    sessionFilter: z13.array(z13.string()).optional(),
    target: z13.enum(["dm", "channel", "both"]).optional()
  }).strict().optional(),
  markdown: MarkdownConfigSchema,
  enabled: z13.boolean().optional(),
  commands: ProviderCommandsSchema,
  customCommands: z13.array(TelegramCustomCommandSchema).optional(),
  configWrites: z13.boolean().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  botToken: SecretInputSchema.optional().register(sensitive),
  tokenFile: z13.string().optional(),
  replyToMode: ReplyToModeSchema.optional(),
  dm: TelegramDmSchema.optional(),
  groups: z13.record(z13.string(), TelegramGroupSchema.optional()).optional(),
  allowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  defaultTo: z13.union([z13.string(), z13.number()]).optional(),
  groupAllowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  contextVisibility: ContextVisibilityModeSchema.optional(),
  historyLimit: z13.number().int().min(0).optional(),
  dmHistoryLimit: z13.number().int().min(0).optional(),
  dms: z13.record(z13.string(), DmConfigSchema.optional()).optional(),
  direct: z13.record(z13.string(), TelegramDirectSchema.optional()).optional(),
  textChunkLimit: z13.number().int().positive().optional(),
  streaming: ChannelPreviewStreamingConfigSchema.optional(),
  mediaMaxMb: z13.number().positive().optional(),
  timeoutSeconds: z13.number().int().positive().optional(),
  mediaGroupFlushMs: z13.number().int().min(10).max(6e4).optional().describe(
    "Buffer window in milliseconds for Telegram media groups/albums before dispatching them as one inbound message. Default: 500."
  ),
  pollingStallThresholdMs: z13.number().int().min(3e4).max(6e5).optional(),
  retry: RetryConfigSchema,
  network: z13.object({
    autoSelectFamily: z13.boolean().optional(),
    dnsResultOrder: z13.enum(["ipv4first", "verbatim"]).optional(),
    dangerouslyAllowPrivateNetwork: z13.boolean().optional().describe(
      "Dangerous opt-in for trusted Telegram fake-IP or transparent-proxy environments where api.telegram.org resolves to private/internal/special-use addresses during media downloads."
    )
  }).strict().optional(),
  proxy: z13.string().optional(),
  webhookUrl: z13.string().optional().describe(
    "Public HTTPS webhook URL registered with Telegram for inbound updates. This must be internet-reachable and requires channels.telegram.webhookSecret."
  ),
  webhookSecret: SecretInputSchema.optional().describe(
    "Secret token sent to Telegram during webhook registration and verified on inbound webhook requests. Telegram returns this value for verification; this is not the gateway auth token and not the bot token."
  ).register(sensitive),
  webhookPath: z13.string().optional().describe(
    "Local webhook route path served by the gateway listener. Defaults to /telegram-webhook."
  ),
  webhookHost: z13.string().optional().describe(
    "Local bind host for the webhook listener. Defaults to 127.0.0.1; keep loopback unless you intentionally expose direct ingress."
  ),
  webhookPort: z13.number().int().nonnegative().optional().describe(
    "Local bind port for the webhook listener. Defaults to 8787; set to 0 to let the OS assign an ephemeral port."
  ),
  webhookCertPath: z13.string().optional().describe(
    "Path to the self-signed certificate (PEM) to upload to Telegram during webhook registration. Required for self-signed certs (direct IP or no domain)."
  ),
  actions: z13.object({
    reactions: z13.boolean().optional(),
    sendMessage: z13.boolean().optional(),
    poll: z13.boolean().optional(),
    deleteMessage: z13.boolean().optional(),
    editMessage: z13.boolean().optional(),
    sticker: z13.boolean().optional(),
    createForumTopic: z13.boolean().optional(),
    editForumTopic: z13.boolean().optional()
  }).strict().optional(),
  threadBindings: z13.object({
    enabled: z13.boolean().optional(),
    idleHours: z13.number().nonnegative().optional(),
    maxAgeHours: z13.number().nonnegative().optional(),
    spawnSessions: z13.boolean().optional(),
    defaultSpawnContext: z13.enum(["isolated", "fork"]).optional(),
    spawnSubagentSessions: z13.boolean().optional(),
    spawnAcpSessions: z13.boolean().optional()
  }).strict().optional(),
  reactionNotifications: z13.enum(["off", "own", "all"]).optional(),
  reactionLevel: z13.enum(["off", "ack", "minimal", "extensive"]).optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  healthMonitor: ChannelHealthMonitorSchema,
  linkPreview: z13.boolean().optional(),
  silentErrorReplies: z13.boolean().optional(),
  responsePrefix: z13.string().optional(),
  ackReaction: z13.string().optional(),
  errorPolicy: TelegramErrorPolicySchema,
  errorCooldownMs: z13.number().int().nonnegative().optional(),
  apiRoot: z13.string().url().optional(),
  trustedLocalFileRoots: z13.array(z13.string()).optional().describe(
    "Trusted local filesystem roots for self-hosted Telegram Bot API absolute file_path values. Only absolute paths under these roots are read directly; all other absolute paths are rejected."
  ),
  autoTopicLabel: AutoTopicLabelSchema
}).strict();
var TelegramAccountSchema = TelegramAccountSchemaBase.superRefine((value, ctx) => {
  validateTelegramCustomCommands(value, ctx);
});
var TelegramConfigSchema = TelegramAccountSchemaBase.extend({
  accounts: z13.record(z13.string(), TelegramAccountSchema.optional()).optional(),
  defaultAccount: z13.string().optional()
}).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.telegram.dmPolicy="open" requires channels.telegram.allowFrom to include "*"'
  });
  requireAllowlistAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.telegram.dmPolicy="allowlist" requires channels.telegram.allowFrom to contain at least one sender ID'
  });
  validateTelegramCustomCommands(value, ctx);
  if (value.accounts) {
    for (const [accountId, account] of Object.entries(value.accounts)) {
      if (!account) {
        continue;
      }
      const effectivePolicy = account.dmPolicy ?? value.dmPolicy;
      const effectiveAllowFrom = account.allowFrom ?? value.allowFrom;
      requireOpenAllowFrom({
        policy: effectivePolicy,
        allowFrom: effectiveAllowFrom,
        ctx,
        path: ["accounts", accountId, "allowFrom"],
        message: 'channels.telegram.accounts.*.dmPolicy="open" requires channels.telegram.accounts.*.allowFrom (or channels.telegram.allowFrom) to include "*"'
      });
      requireAllowlistAllowFrom({
        policy: effectivePolicy,
        allowFrom: effectiveAllowFrom,
        ctx,
        path: ["accounts", accountId, "allowFrom"],
        message: 'channels.telegram.accounts.*.dmPolicy="allowlist" requires channels.telegram.accounts.*.allowFrom (or channels.telegram.allowFrom) to contain at least one sender ID'
      });
    }
  }
  if (!value.accounts) {
    validateTelegramWebhookSecretRequirements(value, ctx);
    return;
  }
  for (const [accountId, account] of Object.entries(value.accounts)) {
    if (!account) {
      continue;
    }
    if (account.enabled === false) {
      continue;
    }
    const effectiveDmPolicy = account.dmPolicy ?? value.dmPolicy;
    const effectiveAllowFrom = Array.isArray(account.allowFrom) ? account.allowFrom : value.allowFrom;
    requireOpenAllowFrom({
      policy: effectiveDmPolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.telegram.accounts.*.dmPolicy="open" requires channels.telegram.allowFrom or channels.telegram.accounts.*.allowFrom to include "*"'
    });
    requireAllowlistAllowFrom({
      policy: effectiveDmPolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.telegram.accounts.*.dmPolicy="allowlist" requires channels.telegram.allowFrom or channels.telegram.accounts.*.allowFrom to contain at least one sender ID'
    });
  }
  validateTelegramWebhookSecretRequirements(value, ctx);
});
var DiscordDmSchema = z13.object({
  enabled: z13.boolean().optional(),
  policy: DmPolicySchema.optional(),
  allowFrom: DiscordIdListSchema.optional(),
  groupEnabled: z13.boolean().optional(),
  groupChannels: DiscordIdListSchema.optional()
}).strict();
var DiscordThreadSchema = z13.object({
  inheritParent: z13.boolean().optional()
}).strict();
var DiscordGuildChannelSchema = z13.object({
  requireMention: z13.boolean().optional(),
  ignoreOtherMentions: z13.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema,
  skills: z13.array(z13.string()).optional(),
  enabled: z13.boolean().optional(),
  users: DiscordIdListSchema.optional(),
  roles: DiscordIdListSchema.optional(),
  systemPrompt: z13.string().optional(),
  includeThreadStarter: z13.boolean().optional(),
  autoThread: z13.boolean().optional(),
  /** Naming strategy for auto-created threads. "message" uses message text; "generated" creates an LLM title after thread creation. */
  autoThreadName: z13.enum(["message", "generated"]).optional(),
  /** Archive duration for auto-created threads in minutes. Discord supports 60, 1440 (1 day), 4320 (3 days), 10080 (1 week). Default: 60. */
  autoArchiveDuration: z13.union([
    z13.enum(["60", "1440", "4320", "10080"]),
    z13.literal(60),
    z13.literal(1440),
    z13.literal(4320),
    z13.literal(10080)
  ]).optional()
}).strict();
var DiscordGuildSchema = z13.object({
  slug: z13.string().optional(),
  requireMention: z13.boolean().optional(),
  ignoreOtherMentions: z13.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema,
  reactionNotifications: z13.enum(["off", "own", "all", "allowlist"]).optional(),
  users: DiscordIdListSchema.optional(),
  roles: DiscordIdListSchema.optional(),
  channels: z13.record(z13.string(), DiscordGuildChannelSchema.optional()).optional()
}).strict();
var DiscordUiSchema = z13.object({
  components: z13.object({
    accentColor: HexColorSchema.optional()
  }).strict().optional()
}).strict().optional();
var DiscordVoiceAutoJoinSchema = z13.object({
  guildId: z13.string().min(1),
  channelId: z13.string().min(1)
}).strict();
var DiscordVoiceSchema = z13.object({
  enabled: z13.boolean().optional(),
  model: z13.string().min(1).optional(),
  autoJoin: z13.array(DiscordVoiceAutoJoinSchema).optional(),
  daveEncryption: z13.boolean().optional(),
  decryptionFailureTolerance: z13.number().int().min(0).optional(),
  connectTimeoutMs: z13.number().int().positive().max(12e4).optional(),
  reconnectGraceMs: z13.number().int().positive().max(12e4).optional(),
  tts: TtsConfigSchema.optional()
}).strict().optional();
var DiscordAccountSchema = z13.object({
  name: z13.string().optional(),
  capabilities: z13.array(z13.string()).optional(),
  markdown: MarkdownConfigSchema,
  enabled: z13.boolean().optional(),
  commands: ProviderCommandsSchema,
  configWrites: z13.boolean().optional(),
  token: SecretInputSchema.optional().register(sensitive),
  applicationId: DiscordIdSchema.optional(),
  proxy: z13.string().optional(),
  gatewayInfoTimeoutMs: z13.number().int().positive().max(12e4).optional(),
  gatewayReadyTimeoutMs: z13.number().int().positive().max(12e4).optional(),
  gatewayRuntimeReadyTimeoutMs: z13.number().int().positive().max(12e4).optional(),
  allowBots: z13.union([z13.boolean(), z13.literal("mentions")]).optional(),
  dangerouslyAllowNameMatching: z13.boolean().optional(),
  mentionAliases: z13.record(z13.string(), DiscordSnowflakeStringSchema).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  contextVisibility: ContextVisibilityModeSchema.optional(),
  historyLimit: z13.number().int().min(0).optional(),
  dmHistoryLimit: z13.number().int().min(0).optional(),
  dms: z13.record(z13.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: z13.number().int().positive().optional(),
  streaming: ChannelPreviewStreamingConfigSchema.optional(),
  maxLinesPerMessage: z13.number().int().positive().optional(),
  mediaMaxMb: z13.number().positive().optional(),
  retry: RetryConfigSchema,
  actions: z13.object({
    reactions: z13.boolean().optional(),
    stickers: z13.boolean().optional(),
    emojiUploads: z13.boolean().optional(),
    stickerUploads: z13.boolean().optional(),
    polls: z13.boolean().optional(),
    permissions: z13.boolean().optional(),
    messages: z13.boolean().optional(),
    threads: z13.boolean().optional(),
    pins: z13.boolean().optional(),
    search: z13.boolean().optional(),
    memberInfo: z13.boolean().optional(),
    roleInfo: z13.boolean().optional(),
    roles: z13.boolean().optional(),
    channelInfo: z13.boolean().optional(),
    voiceStatus: z13.boolean().optional(),
    events: z13.boolean().optional(),
    moderation: z13.boolean().optional(),
    channels: z13.boolean().optional(),
    presence: z13.boolean().optional()
  }).strict().optional(),
  replyToMode: ReplyToModeSchema.optional(),
  thread: DiscordThreadSchema.optional(),
  // Aliases for channels.discord.dm.policy / channels.discord.dm.allowFrom. Prefer these for
  // inheritance in multi-account setups (shallow merge works; nested dm object doesn't).
  dmPolicy: DmPolicySchema.optional(),
  allowFrom: DiscordIdListSchema.optional(),
  defaultTo: z13.string().optional(),
  dm: DiscordDmSchema.optional(),
  guilds: z13.record(z13.string(), DiscordGuildSchema.optional()).optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  healthMonitor: ChannelHealthMonitorSchema,
  execApprovals: z13.object({
    enabled: z13.boolean().optional(),
    approvers: DiscordIdListSchema.optional(),
    agentFilter: z13.array(z13.string()).optional(),
    sessionFilter: z13.array(z13.string()).optional(),
    cleanupAfterResolve: z13.boolean().optional(),
    target: z13.enum(["dm", "channel", "both"]).optional()
  }).strict().optional(),
  agentComponents: z13.object({
    enabled: z13.boolean().optional()
  }).strict().optional(),
  ui: DiscordUiSchema,
  slashCommand: z13.object({
    ephemeral: z13.boolean().optional()
  }).strict().optional(),
  threadBindings: z13.object({
    enabled: z13.boolean().optional(),
    idleHours: z13.number().nonnegative().optional(),
    maxAgeHours: z13.number().nonnegative().optional(),
    spawnSessions: z13.boolean().optional(),
    defaultSpawnContext: z13.enum(["isolated", "fork"]).optional(),
    spawnSubagentSessions: z13.boolean().optional(),
    spawnAcpSessions: z13.boolean().optional()
  }).strict().optional(),
  intents: z13.object({
    presence: z13.boolean().optional(),
    guildMembers: z13.boolean().optional(),
    voiceStates: z13.boolean().optional()
  }).strict().optional(),
  voice: DiscordVoiceSchema,
  pluralkit: z13.object({
    enabled: z13.boolean().optional(),
    token: SecretInputSchema.optional().register(sensitive)
  }).strict().optional(),
  responsePrefix: z13.string().optional(),
  ackReaction: z13.string().optional(),
  ackReactionScope: z13.enum(["group-mentions", "group-all", "direct", "all", "off", "none"]).optional(),
  activity: z13.string().optional(),
  status: z13.enum(["online", "dnd", "idle", "invisible"]).optional(),
  autoPresence: z13.object({
    enabled: z13.boolean().optional(),
    intervalMs: z13.number().int().positive().optional(),
    minUpdateIntervalMs: z13.number().int().positive().optional(),
    healthyText: z13.string().optional(),
    degradedText: z13.string().optional(),
    exhaustedText: z13.string().optional()
  }).strict().optional(),
  activityType: z13.union([z13.literal(0), z13.literal(1), z13.literal(2), z13.literal(3), z13.literal(4), z13.literal(5)]).optional(),
  activityUrl: z13.string().url().optional(),
  inboundWorker: z13.object({
    runTimeoutMs: z13.number().int().nonnegative().optional()
  }).strict().optional(),
  eventQueue: z13.object({
    listenerTimeout: z13.number().int().positive().optional(),
    maxQueueSize: z13.number().int().positive().optional(),
    maxConcurrency: z13.number().int().positive().optional()
  }).strict().optional()
}).strict().superRefine((value, ctx) => {
  const activityText = normalizeOptionalString(value.activity) ?? "";
  const hasActivity = Boolean(activityText);
  const hasActivityType = value.activityType !== void 0;
  const activityUrl = normalizeOptionalString(value.activityUrl) ?? "";
  const hasActivityUrl = Boolean(activityUrl);
  if ((hasActivityType || hasActivityUrl) && !hasActivity) {
    ctx.addIssue({
      code: z13.ZodIssueCode.custom,
      message: "channels.discord.activity is required when activityType or activityUrl is set",
      path: ["activity"]
    });
  }
  if (value.activityType === 1 && !hasActivityUrl) {
    ctx.addIssue({
      code: z13.ZodIssueCode.custom,
      message: "channels.discord.activityUrl is required when activityType is 1 (Streaming)",
      path: ["activityUrl"]
    });
  }
  if (hasActivityUrl && value.activityType !== 1) {
    ctx.addIssue({
      code: z13.ZodIssueCode.custom,
      message: "channels.discord.activityType must be 1 (Streaming) when activityUrl is set",
      path: ["activityType"]
    });
  }
  const autoPresenceInterval = value.autoPresence?.intervalMs;
  const autoPresenceMinUpdate = value.autoPresence?.minUpdateIntervalMs;
  if (typeof autoPresenceInterval === "number" && typeof autoPresenceMinUpdate === "number" && autoPresenceMinUpdate > autoPresenceInterval) {
    ctx.addIssue({
      code: z13.ZodIssueCode.custom,
      message: "channels.discord.autoPresence.minUpdateIntervalMs must be less than or equal to channels.discord.autoPresence.intervalMs",
      path: ["autoPresence", "minUpdateIntervalMs"]
    });
  }
});
var DiscordConfigSchema = DiscordAccountSchema.extend({
  accounts: z13.record(z13.string(), DiscordAccountSchema.optional()).optional(),
  defaultAccount: z13.string().optional()
}).superRefine((value, ctx) => {
  const dmPolicy = value.dmPolicy ?? value.dm?.policy ?? "pairing";
  const allowFrom = value.allowFrom ?? value.dm?.allowFrom;
  const allowFromPath = value.allowFrom !== void 0 ? ["allowFrom"] : ["dm", "allowFrom"];
  requireOpenAllowFrom({
    policy: dmPolicy,
    allowFrom,
    ctx,
    path: [...allowFromPath],
    message: 'channels.discord.dmPolicy="open" requires channels.discord.allowFrom (or channels.discord.dm.allowFrom) to include "*"'
  });
  requireAllowlistAllowFrom({
    policy: dmPolicy,
    allowFrom,
    ctx,
    path: [...allowFromPath],
    message: 'channels.discord.dmPolicy="allowlist" requires channels.discord.allowFrom (or channels.discord.dm.allowFrom) to contain at least one sender ID'
  });
  if (!value.accounts) {
    return;
  }
  for (const [accountId, account] of Object.entries(value.accounts)) {
    if (!account) {
      continue;
    }
    const effectivePolicy = account.dmPolicy ?? account.dm?.policy ?? value.dmPolicy ?? value.dm?.policy ?? "pairing";
    const effectiveAllowFrom = account.allowFrom ?? account.dm?.allowFrom ?? value.allowFrom ?? value.dm?.allowFrom;
    requireOpenAllowFrom({
      policy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.discord.accounts.*.dmPolicy="open" requires channels.discord.accounts.*.allowFrom (or channels.discord.allowFrom) to include "*"'
    });
    requireAllowlistAllowFrom({
      policy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.discord.accounts.*.dmPolicy="allowlist" requires channels.discord.accounts.*.allowFrom (or channels.discord.allowFrom) to contain at least one sender ID'
    });
  }
});
var GoogleChatDmSchema = z13.object({
  enabled: z13.boolean().optional(),
  policy: DmPolicySchema.optional().default("pairing"),
  allowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional()
}).strict().superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.policy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.googlechat.dm.policy="open" requires channels.googlechat.dm.allowFrom to include "*"'
  });
  requireAllowlistAllowFrom({
    policy: value.policy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.googlechat.dm.policy="allowlist" requires channels.googlechat.dm.allowFrom to contain at least one sender ID'
  });
});
var GoogleChatGroupSchema = z13.object({
  enabled: z13.boolean().optional(),
  requireMention: z13.boolean().optional(),
  users: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  systemPrompt: z13.string().optional()
}).strict();
var GoogleChatAccountSchema = z13.object({
  name: z13.string().optional(),
  capabilities: z13.array(z13.string()).optional(),
  enabled: z13.boolean().optional(),
  configWrites: z13.boolean().optional(),
  allowBots: z13.boolean().optional(),
  dangerouslyAllowNameMatching: z13.boolean().optional(),
  requireMention: z13.boolean().optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  groupAllowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  groups: z13.record(z13.string(), GoogleChatGroupSchema.optional()).optional(),
  defaultTo: z13.string().optional(),
  serviceAccount: z13.union([z13.string(), z13.record(z13.string(), z13.unknown()), SecretRefSchema]).optional().register(sensitive),
  serviceAccountRef: SecretRefSchema.optional().register(sensitive),
  serviceAccountFile: z13.string().optional(),
  audienceType: z13.enum(["app-url", "project-number"]).optional(),
  audience: z13.string().optional(),
  appPrincipal: z13.string().optional(),
  webhookPath: z13.string().optional(),
  webhookUrl: z13.string().optional(),
  botUser: z13.string().optional(),
  historyLimit: z13.number().int().min(0).optional(),
  dmHistoryLimit: z13.number().int().min(0).optional(),
  dms: z13.record(z13.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: z13.number().int().positive().optional(),
  chunkMode: z13.enum(["length", "newline"]).optional(),
  blockStreaming: z13.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  mediaMaxMb: z13.number().positive().optional(),
  replyToMode: ReplyToModeSchema.optional(),
  actions: z13.object({
    reactions: z13.boolean().optional()
  }).strict().optional(),
  dm: GoogleChatDmSchema.optional(),
  healthMonitor: ChannelHealthMonitorSchema,
  typingIndicator: z13.enum(["none", "message", "reaction"]).optional(),
  responsePrefix: z13.string().optional()
}).strict();
var GoogleChatConfigSchema = GoogleChatAccountSchema.extend({
  accounts: z13.record(z13.string(), GoogleChatAccountSchema.optional()).optional(),
  defaultAccount: z13.string().optional()
});
var SlackDmSchema = z13.object({
  enabled: z13.boolean().optional(),
  policy: DmPolicySchema.optional(),
  allowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  groupEnabled: z13.boolean().optional(),
  groupChannels: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  replyToMode: ReplyToModeSchema.optional()
}).strict();
var SlackChannelSchema = z13.object({
  enabled: z13.boolean().optional(),
  requireMention: z13.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema,
  allowBots: z13.boolean().optional(),
  users: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  skills: z13.array(z13.string()).optional(),
  systemPrompt: z13.string().optional()
}).strict();
var SlackThreadSchema = z13.object({
  historyScope: z13.enum(["thread", "channel"]).optional(),
  inheritParent: z13.boolean().optional(),
  initialHistoryLimit: z13.number().int().min(0).optional(),
  requireExplicitMention: z13.boolean().optional()
}).strict();
var SlackReplyToModeByChatTypeSchema = z13.object({
  direct: ReplyToModeSchema.optional(),
  group: ReplyToModeSchema.optional(),
  channel: ReplyToModeSchema.optional()
}).strict();
var SlackSocketModeSchema = z13.object({
  clientPingTimeout: z13.number().int().positive().optional(),
  serverPingTimeout: z13.number().int().positive().optional(),
  pingPongLoggingEnabled: z13.boolean().optional()
}).strict();
var SlackAccountSchema = z13.object({
  name: z13.string().optional(),
  mode: z13.enum(["socket", "http"]).optional(),
  socketMode: SlackSocketModeSchema.optional(),
  signingSecret: SecretInputSchema.optional().register(sensitive),
  webhookPath: z13.string().optional(),
  capabilities: SlackCapabilitiesSchema.optional(),
  execApprovals: z13.object({
    enabled: z13.boolean().optional(),
    approvers: z13.array(z13.union([z13.string(), z13.number()])).optional(),
    agentFilter: z13.array(z13.string()).optional(),
    sessionFilter: z13.array(z13.string()).optional(),
    target: z13.enum(["dm", "channel", "both"]).optional()
  }).strict().optional(),
  markdown: MarkdownConfigSchema,
  enabled: z13.boolean().optional(),
  commands: ProviderCommandsSchema,
  configWrites: z13.boolean().optional(),
  botToken: SecretInputSchema.optional().register(sensitive),
  appToken: SecretInputSchema.optional().register(sensitive),
  userToken: SecretInputSchema.optional().register(sensitive),
  userTokenReadOnly: z13.boolean().optional().default(true),
  allowBots: z13.boolean().optional(),
  dangerouslyAllowNameMatching: z13.boolean().optional(),
  requireMention: z13.boolean().optional(),
  groupPolicy: GroupPolicySchema.optional(),
  contextVisibility: ContextVisibilityModeSchema.optional(),
  historyLimit: z13.number().int().min(0).optional(),
  dmHistoryLimit: z13.number().int().min(0).optional(),
  dms: z13.record(z13.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: z13.number().int().positive().optional(),
  streaming: SlackStreamingConfigSchema.optional(),
  mediaMaxMb: z13.number().positive().optional(),
  reactionNotifications: z13.enum(["off", "own", "all", "allowlist"]).optional(),
  reactionAllowlist: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  replyToMode: ReplyToModeSchema.optional(),
  replyToModeByChatType: SlackReplyToModeByChatTypeSchema.optional(),
  thread: SlackThreadSchema.optional(),
  actions: z13.object({
    reactions: z13.boolean().optional(),
    messages: z13.boolean().optional(),
    pins: z13.boolean().optional(),
    search: z13.boolean().optional(),
    permissions: z13.boolean().optional(),
    memberInfo: z13.boolean().optional(),
    channelInfo: z13.boolean().optional(),
    emojiList: z13.boolean().optional()
  }).strict().optional(),
  slashCommand: z13.object({
    enabled: z13.boolean().optional(),
    name: z13.string().optional(),
    sessionPrefix: z13.string().optional(),
    ephemeral: z13.boolean().optional()
  }).strict().optional(),
  // Aliases for channels.slack.dm.policy / channels.slack.dm.allowFrom. Prefer these for
  // inheritance in multi-account setups (shallow merge works; nested dm object doesn't).
  dmPolicy: DmPolicySchema.optional(),
  allowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  defaultTo: z13.string().optional(),
  dm: SlackDmSchema.optional(),
  channels: z13.record(z13.string(), SlackChannelSchema.optional()).optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  healthMonitor: ChannelHealthMonitorSchema,
  responsePrefix: z13.string().optional(),
  ackReaction: z13.string().optional(),
  typingReaction: z13.string().optional()
}).strict().superRefine(() => {
});
var SlackConfigSchema = SlackAccountSchema.safeExtend({
  mode: z13.enum(["socket", "http"]).optional().default("socket"),
  signingSecret: SecretInputSchema.optional().register(sensitive),
  webhookPath: z13.string().optional().default("/slack/events"),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  contextVisibility: ContextVisibilityModeSchema.optional(),
  accounts: z13.record(z13.string(), SlackAccountSchema.optional()).optional(),
  defaultAccount: z13.string().optional()
}).superRefine((value, ctx) => {
  const dmPolicy = value.dmPolicy ?? value.dm?.policy ?? "pairing";
  const allowFrom = value.allowFrom ?? value.dm?.allowFrom;
  const allowFromPath = value.allowFrom !== void 0 ? ["allowFrom"] : ["dm", "allowFrom"];
  requireOpenAllowFrom({
    policy: dmPolicy,
    allowFrom,
    ctx,
    path: [...allowFromPath],
    message: 'channels.slack.dmPolicy="open" requires channels.slack.allowFrom (or channels.slack.dm.allowFrom) to include "*"'
  });
  requireAllowlistAllowFrom({
    policy: dmPolicy,
    allowFrom,
    ctx,
    path: [...allowFromPath],
    message: 'channels.slack.dmPolicy="allowlist" requires channels.slack.allowFrom (or channels.slack.dm.allowFrom) to contain at least one sender ID'
  });
  const baseMode = value.mode ?? "socket";
  if (!value.accounts) {
    validateSlackSigningSecretRequirements(value, ctx);
    return;
  }
  for (const [accountId, account] of Object.entries(value.accounts)) {
    if (!account) {
      continue;
    }
    if (account.enabled === false) {
      continue;
    }
    const accountMode = account.mode ?? baseMode;
    const effectivePolicy = account.dmPolicy ?? account.dm?.policy ?? value.dmPolicy ?? value.dm?.policy ?? "pairing";
    const effectiveAllowFrom = account.allowFrom ?? account.dm?.allowFrom ?? value.allowFrom ?? value.dm?.allowFrom;
    requireOpenAllowFrom({
      policy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.slack.accounts.*.dmPolicy="open" requires channels.slack.accounts.*.allowFrom (or channels.slack.allowFrom) to include "*"'
    });
    requireAllowlistAllowFrom({
      policy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.slack.accounts.*.dmPolicy="allowlist" requires channels.slack.accounts.*.allowFrom (or channels.slack.allowFrom) to contain at least one sender ID'
    });
    if (accountMode !== "http") {
      continue;
    }
  }
  validateSlackSigningSecretRequirements(value, ctx);
});
var SignalGroupEntrySchema = z13.object({
  requireMention: z13.boolean().optional(),
  ingest: z13.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema
}).strict();
var SignalGroupsSchema = z13.record(z13.string(), SignalGroupEntrySchema.optional()).optional();
var SignalAccountSchemaBase = z13.object({
  name: z13.string().optional(),
  capabilities: z13.array(z13.string()).optional(),
  markdown: MarkdownConfigSchema,
  enabled: z13.boolean().optional(),
  configWrites: z13.boolean().optional(),
  account: z13.string().optional(),
  accountUuid: z13.string().optional(),
  httpUrl: z13.string().optional(),
  httpHost: z13.string().optional(),
  httpPort: z13.number().int().positive().optional(),
  cliPath: ExecutableTokenSchema.optional(),
  autoStart: z13.boolean().optional(),
  startupTimeoutMs: z13.number().int().min(1e3).max(12e4).optional(),
  receiveMode: z13.union([z13.literal("on-start"), z13.literal("manual")]).optional(),
  ignoreAttachments: z13.boolean().optional(),
  ignoreStories: z13.boolean().optional(),
  sendReadReceipts: z13.boolean().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  allowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  defaultTo: z13.string().optional(),
  groupAllowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  contextVisibility: ContextVisibilityModeSchema.optional(),
  groups: SignalGroupsSchema,
  historyLimit: z13.number().int().min(0).optional(),
  dmHistoryLimit: z13.number().int().min(0).optional(),
  dms: z13.record(z13.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: z13.number().int().positive().optional(),
  chunkMode: z13.enum(["length", "newline"]).optional(),
  blockStreaming: z13.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  mediaMaxMb: z13.number().int().positive().optional(),
  reactionNotifications: z13.enum(["off", "own", "all", "allowlist"]).optional(),
  reactionAllowlist: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  actions: z13.object({
    reactions: z13.boolean().optional()
  }).strict().optional(),
  reactionLevel: z13.enum(["off", "ack", "minimal", "extensive"]).optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  healthMonitor: ChannelHealthMonitorSchema,
  responsePrefix: z13.string().optional()
}).strict();
var SignalAccountSchema = SignalAccountSchemaBase;
var SignalConfigSchema = SignalAccountSchemaBase.extend({
  accounts: z13.record(z13.string(), SignalAccountSchema.optional()).optional(),
  defaultAccount: z13.string().optional()
}).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.signal.dmPolicy="open" requires channels.signal.allowFrom to include "*"'
  });
  requireAllowlistAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.signal.dmPolicy="allowlist" requires channels.signal.allowFrom to contain at least one sender ID'
  });
  if (!value.accounts) {
    return;
  }
  for (const [accountId, account] of Object.entries(value.accounts)) {
    if (!account) {
      continue;
    }
    const effectivePolicy = account.dmPolicy ?? value.dmPolicy;
    const effectiveAllowFrom = account.allowFrom ?? value.allowFrom;
    requireOpenAllowFrom({
      policy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.signal.accounts.*.dmPolicy="open" requires channels.signal.accounts.*.allowFrom (or channels.signal.allowFrom) to include "*"'
    });
    requireAllowlistAllowFrom({
      policy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.signal.accounts.*.dmPolicy="allowlist" requires channels.signal.accounts.*.allowFrom (or channels.signal.allowFrom) to contain at least one sender ID'
    });
  }
});
var IrcGroupSchema = z13.object({
  requireMention: z13.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema,
  skills: z13.array(z13.string()).optional(),
  enabled: z13.boolean().optional(),
  allowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  systemPrompt: z13.string().optional()
}).strict();
var IrcNickServSchema = z13.object({
  enabled: z13.boolean().optional(),
  service: z13.string().optional(),
  password: SecretInputSchema.optional().register(sensitive),
  passwordFile: z13.string().optional(),
  register: z13.boolean().optional(),
  registerEmail: z13.string().optional()
}).strict();
var IrcAccountSchemaBase = z13.object({
  name: z13.string().optional(),
  capabilities: z13.array(z13.string()).optional(),
  markdown: MarkdownConfigSchema,
  enabled: z13.boolean().optional(),
  configWrites: z13.boolean().optional(),
  host: z13.string().optional(),
  port: z13.number().int().min(1).max(65535).optional(),
  tls: z13.boolean().optional(),
  nick: z13.string().optional(),
  username: z13.string().optional(),
  realname: z13.string().optional(),
  password: SecretInputSchema.optional().register(sensitive),
  passwordFile: z13.string().optional(),
  nickserv: IrcNickServSchema.optional(),
  channels: z13.array(z13.string()).optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  allowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  defaultTo: z13.string().optional(),
  groupAllowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  contextVisibility: ContextVisibilityModeSchema.optional(),
  groups: z13.record(z13.string(), IrcGroupSchema.optional()).optional(),
  mentionPatterns: z13.array(z13.string()).optional(),
  historyLimit: z13.number().int().min(0).optional(),
  dmHistoryLimit: z13.number().int().min(0).optional(),
  dms: z13.record(z13.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: z13.number().int().positive().optional(),
  chunkMode: z13.enum(["length", "newline"]).optional(),
  blockStreaming: z13.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  mediaMaxMb: z13.number().positive().optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  healthMonitor: ChannelHealthMonitorSchema,
  responsePrefix: z13.string().optional()
}).strict();
function refineIrcAllowFromAndNickserv(value, ctx) {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.irc.dmPolicy="open" requires channels.irc.allowFrom to include "*"'
  });
  requireAllowlistAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.irc.dmPolicy="allowlist" requires channels.irc.allowFrom to contain at least one sender ID'
  });
  if (value.nickserv?.register && !value.nickserv.registerEmail?.trim()) {
    ctx.addIssue({
      code: z13.ZodIssueCode.custom,
      path: ["nickserv", "registerEmail"],
      message: "channels.irc.nickserv.register=true requires channels.irc.nickserv.registerEmail"
    });
  }
}
var IrcAccountSchema = IrcAccountSchemaBase.superRefine((value, ctx) => {
  if (value.nickserv?.register && !value.nickserv.registerEmail?.trim()) {
    ctx.addIssue({
      code: z13.ZodIssueCode.custom,
      path: ["nickserv", "registerEmail"],
      message: "channels.irc.nickserv.register=true requires channels.irc.nickserv.registerEmail"
    });
  }
});
var IrcConfigSchema = IrcAccountSchemaBase.extend({
  accounts: z13.record(z13.string(), IrcAccountSchema.optional()).optional(),
  defaultAccount: z13.string().optional()
}).superRefine((value, ctx) => {
  refineIrcAllowFromAndNickserv(value, ctx);
  if (!value.accounts) {
    return;
  }
  for (const [accountId, account] of Object.entries(value.accounts)) {
    if (!account) {
      continue;
    }
    const effectivePolicy = account.dmPolicy ?? value.dmPolicy;
    const effectiveAllowFrom = account.allowFrom ?? value.allowFrom;
    requireOpenAllowFrom({
      policy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.irc.accounts.*.dmPolicy="open" requires channels.irc.accounts.*.allowFrom (or channels.irc.allowFrom) to include "*"'
    });
    requireAllowlistAllowFrom({
      policy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.irc.accounts.*.dmPolicy="allowlist" requires channels.irc.accounts.*.allowFrom (or channels.irc.allowFrom) to contain at least one sender ID'
    });
  }
});
var IMessageAccountSchemaBase = z13.object({
  name: z13.string().optional(),
  capabilities: z13.array(z13.string()).optional(),
  markdown: MarkdownConfigSchema,
  enabled: z13.boolean().optional(),
  configWrites: z13.boolean().optional(),
  cliPath: ExecutableTokenSchema.optional(),
  dbPath: z13.string().optional(),
  remoteHost: z13.string().refine(isSafeScpRemoteHost, "expected SSH host or user@host (no spaces/options)").optional(),
  service: z13.union([z13.literal("imessage"), z13.literal("sms"), z13.literal("auto")]).optional(),
  region: z13.string().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  allowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  defaultTo: z13.string().optional(),
  groupAllowFrom: z13.array(z13.union([z13.string(), z13.number()])).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  contextVisibility: ContextVisibilityModeSchema.optional(),
  historyLimit: z13.number().int().min(0).optional(),
  dmHistoryLimit: z13.number().int().min(0).optional(),
  dms: z13.record(z13.string(), DmConfigSchema.optional()).optional(),
  includeAttachments: z13.boolean().optional(),
  attachmentRoots: z13.array(z13.string().refine(isValidInboundPathRootPattern, "expected absolute path root")).optional(),
  remoteAttachmentRoots: z13.array(z13.string().refine(isValidInboundPathRootPattern, "expected absolute path root")).optional(),
  mediaMaxMb: z13.number().int().positive().optional(),
  textChunkLimit: z13.number().int().positive().optional(),
  chunkMode: z13.enum(["length", "newline"]).optional(),
  blockStreaming: z13.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  groups: z13.record(
    z13.string(),
    z13.object({
      requireMention: z13.boolean().optional(),
      tools: ToolPolicySchema,
      toolsBySender: ToolPolicyBySenderSchema
    }).strict().optional()
  ).optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  healthMonitor: ChannelHealthMonitorSchema,
  responsePrefix: z13.string().optional()
}).strict();
var IMessageAccountSchema = IMessageAccountSchemaBase;
var IMessageConfigSchema = IMessageAccountSchemaBase.extend({
  accounts: z13.record(z13.string(), IMessageAccountSchema.optional()).optional(),
  defaultAccount: z13.string().optional()
}).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.imessage.dmPolicy="open" requires channels.imessage.allowFrom to include "*"'
  });
  requireAllowlistAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.imessage.dmPolicy="allowlist" requires channels.imessage.allowFrom to contain at least one sender ID'
  });
  if (!value.accounts) {
    return;
  }
  for (const [accountId, account] of Object.entries(value.accounts)) {
    if (!account) {
      continue;
    }
    const effectivePolicy = account.dmPolicy ?? value.dmPolicy;
    const effectiveAllowFrom = account.allowFrom ?? value.allowFrom;
    requireOpenAllowFrom({
      policy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.imessage.accounts.*.dmPolicy="open" requires channels.imessage.accounts.*.allowFrom (or channels.imessage.allowFrom) to include "*"'
    });
    requireAllowlistAllowFrom({
      policy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.imessage.accounts.*.dmPolicy="allowlist" requires channels.imessage.accounts.*.allowFrom (or channels.imessage.allowFrom) to contain at least one sender ID'
    });
  }
});
var BlueBubblesAllowFromEntry = z13.union([z13.string(), z13.number()]);
var BlueBubblesActionSchema = z13.object({
  reactions: z13.boolean().optional(),
  edit: z13.boolean().optional(),
  unsend: z13.boolean().optional(),
  reply: z13.boolean().optional(),
  sendWithEffect: z13.boolean().optional(),
  renameGroup: z13.boolean().optional(),
  setGroupIcon: z13.boolean().optional(),
  addParticipant: z13.boolean().optional(),
  removeParticipant: z13.boolean().optional(),
  leaveGroup: z13.boolean().optional(),
  sendAttachment: z13.boolean().optional()
}).strict().optional();
var BlueBubblesGroupConfigSchema = z13.object({
  requireMention: z13.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema
}).strict();
var BlueBubblesAccountSchemaBase = z13.object({
  name: z13.string().optional(),
  capabilities: z13.array(z13.string()).optional(),
  markdown: MarkdownConfigSchema,
  configWrites: z13.boolean().optional(),
  enabled: z13.boolean().optional(),
  serverUrl: z13.string().optional(),
  password: SecretInputSchema.optional().register(sensitive),
  webhookPath: z13.string().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  allowFrom: z13.array(BlueBubblesAllowFromEntry).optional(),
  groupAllowFrom: z13.array(BlueBubblesAllowFromEntry).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  contextVisibility: ContextVisibilityModeSchema.optional(),
  historyLimit: z13.number().int().min(0).optional(),
  dmHistoryLimit: z13.number().int().min(0).optional(),
  dms: z13.record(z13.string(), DmConfigSchema.optional()).optional(),
  textChunkLimit: z13.number().int().positive().optional(),
  sendTimeoutMs: z13.number().int().positive().optional(),
  chunkMode: z13.enum(["length", "newline"]).optional(),
  mediaMaxMb: z13.number().int().positive().optional(),
  mediaLocalRoots: z13.array(z13.string()).optional(),
  sendReadReceipts: z13.boolean().optional(),
  network: z13.object({
    dangerouslyAllowPrivateNetwork: z13.boolean().optional()
  }).strict().optional(),
  blockStreaming: z13.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  groups: z13.record(z13.string(), BlueBubblesGroupConfigSchema.optional()).optional(),
  enrichGroupParticipantsFromContacts: z13.boolean().optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  healthMonitor: ChannelHealthMonitorSchema,
  responsePrefix: z13.string().optional(),
  coalesceSameSenderDms: z13.boolean().optional()
}).strict();
var BlueBubblesAccountSchema = BlueBubblesAccountSchemaBase;
var BlueBubblesConfigSchema = BlueBubblesAccountSchemaBase.extend({
  accounts: z13.record(z13.string(), BlueBubblesAccountSchema.optional()).optional(),
  defaultAccount: z13.string().optional(),
  actions: BlueBubblesActionSchema
}).superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.bluebubbles.dmPolicy="open" requires channels.bluebubbles.allowFrom to include "*"'
  });
  requireAllowlistAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.bluebubbles.dmPolicy="allowlist" requires channels.bluebubbles.allowFrom to contain at least one sender ID'
  });
  if (!value.accounts) {
    return;
  }
  for (const [accountId, account] of Object.entries(value.accounts)) {
    if (!account) {
      continue;
    }
    const effectivePolicy = account.dmPolicy ?? value.dmPolicy;
    const effectiveAllowFrom = account.allowFrom ?? value.allowFrom;
    requireOpenAllowFrom({
      policy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.bluebubbles.accounts.*.dmPolicy="open" requires channels.bluebubbles.accounts.*.allowFrom (or channels.bluebubbles.allowFrom) to include "*"'
    });
    requireAllowlistAllowFrom({
      policy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.bluebubbles.accounts.*.dmPolicy="allowlist" requires channels.bluebubbles.accounts.*.allowFrom (or channels.bluebubbles.allowFrom) to contain at least one sender ID'
    });
  }
});
var MSTeamsChannelSchema = z13.object({
  requireMention: z13.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema,
  replyStyle: MSTeamsReplyStyleSchema.optional()
}).strict();
var MSTeamsTeamSchema = z13.object({
  requireMention: z13.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema,
  replyStyle: MSTeamsReplyStyleSchema.optional(),
  channels: z13.record(z13.string(), MSTeamsChannelSchema.optional()).optional()
}).strict();
var MSTeamsConfigSchema = z13.object({
  enabled: z13.boolean().optional(),
  capabilities: z13.array(z13.string()).optional(),
  dangerouslyAllowNameMatching: z13.boolean().optional(),
  markdown: MarkdownConfigSchema,
  configWrites: z13.boolean().optional(),
  appId: z13.string().optional(),
  appPassword: SecretInputSchema.optional().register(sensitive),
  tenantId: z13.string().optional(),
  authType: z13.enum(["secret", "federated"]).optional(),
  certificatePath: z13.string().optional(),
  certificateThumbprint: z13.string().optional(),
  useManagedIdentity: z13.boolean().optional(),
  managedIdentityClientId: z13.string().optional(),
  webhook: z13.object({
    port: z13.number().int().positive().optional(),
    path: z13.string().optional()
  }).strict().optional(),
  dmPolicy: DmPolicySchema.optional().default("pairing"),
  allowFrom: z13.array(z13.string()).optional(),
  defaultTo: z13.string().optional(),
  groupAllowFrom: z13.array(z13.string()).optional(),
  groupPolicy: GroupPolicySchema.optional().default("allowlist"),
  contextVisibility: ContextVisibilityModeSchema.optional(),
  textChunkLimit: z13.number().int().positive().optional(),
  chunkMode: z13.enum(["length", "newline"]).optional(),
  streaming: ChannelPreviewStreamingConfigSchema.optional(),
  typingIndicator: z13.boolean().optional(),
  blockStreaming: z13.boolean().optional(),
  blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
  mediaAllowHosts: z13.array(z13.string()).optional(),
  mediaAuthAllowHosts: z13.array(z13.string()).optional(),
  requireMention: z13.boolean().optional(),
  historyLimit: z13.number().int().min(0).optional(),
  dmHistoryLimit: z13.number().int().min(0).optional(),
  dms: z13.record(z13.string(), DmConfigSchema.optional()).optional(),
  replyStyle: MSTeamsReplyStyleSchema.optional(),
  teams: z13.record(z13.string(), MSTeamsTeamSchema.optional()).optional(),
  /** Max media size in MB (default: 100MB for OneDrive upload support). */
  mediaMaxMb: z13.number().positive().optional(),
  /** SharePoint site ID for file uploads in group chats/channels (e.g., "contoso.sharepoint.com,guid1,guid2") */
  sharePointSiteId: z13.string().optional(),
  heartbeat: ChannelHeartbeatVisibilitySchema,
  healthMonitor: ChannelHealthMonitorSchema,
  responsePrefix: z13.string().optional(),
  welcomeCard: z13.boolean().optional(),
  promptStarters: z13.array(z13.string()).optional(),
  groupWelcomeCard: z13.boolean().optional(),
  feedbackEnabled: z13.boolean().optional(),
  feedbackReflection: z13.boolean().optional(),
  feedbackReflectionCooldownMs: z13.number().int().min(0).optional(),
  delegatedAuth: z13.object({
    enabled: z13.boolean().optional(),
    scopes: z13.array(z13.string()).optional()
  }).strict().optional(),
  sso: z13.object({
    enabled: z13.boolean().optional(),
    connectionName: z13.string().optional()
  }).strict().optional()
}).strict().superRefine((value, ctx) => {
  requireOpenAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.msteams.dmPolicy="open" requires channels.msteams.allowFrom to include "*"'
  });
  requireAllowlistAllowFrom({
    policy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    path: ["allowFrom"],
    message: 'channels.msteams.dmPolicy="allowlist" requires channels.msteams.allowFrom to contain at least one sender ID'
  });
  if (value.sso?.enabled === true && !value.sso.connectionName?.trim()) {
    ctx.addIssue({
      code: z13.ZodIssueCode.custom,
      path: ["sso", "connectionName"],
      message: "channels.msteams.sso.enabled=true requires channels.msteams.sso.connectionName to identify the Bot Framework OAuth connection"
    });
  }
});

// vendor/openclaw/src/config/zod-schema.providers-whatsapp.ts
import { z as z14 } from "zod";

// vendor/openclaw/src/routing/account-lookup.ts
function resolveAccountEntry(accounts, accountId) {
  if (!accounts || typeof accounts !== "object") {
    return void 0;
  }
  if (Object.hasOwn(accounts, accountId)) {
    return accounts[accountId];
  }
  const normalized = normalizeLowercaseStringOrEmpty(accountId);
  const matchKey = Object.keys(accounts).find(
    (key) => normalizeLowercaseStringOrEmpty(key) === normalized
  );
  return matchKey ? accounts[matchKey] : void 0;
}

// vendor/openclaw/src/config/zod-schema.providers-whatsapp.ts
var ToolPolicyBySenderSchema2 = z14.record(z14.string(), ToolPolicySchema).optional();
var WhatsAppGroupEntrySchema = z14.object({
  requireMention: z14.boolean().optional(),
  tools: ToolPolicySchema,
  toolsBySender: ToolPolicyBySenderSchema2,
  systemPrompt: z14.string().optional()
}).strict().optional();
var WhatsAppGroupsSchema = z14.record(z14.string(), WhatsAppGroupEntrySchema).optional();
var WhatsAppDirectEntrySchema = z14.object({
  systemPrompt: z14.string().optional()
}).strict().optional();
var WhatsAppDirectSchema = z14.record(z14.string(), WhatsAppDirectEntrySchema).optional();
var WhatsAppAckReactionSchema = z14.object({
  emoji: z14.string().optional(),
  direct: z14.boolean().optional().default(true),
  group: z14.enum(["always", "mentions", "never"]).optional().default("mentions")
}).strict().optional();
function stripDeprecatedWhatsAppNoopKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  if (!Object.hasOwn(value, "exposeErrorText")) {
    return value;
  }
  const next = { ...value };
  delete next.exposeErrorText;
  return next;
}
function buildWhatsAppCommonShape(params) {
  return {
    enabled: z14.boolean().optional(),
    capabilities: z14.array(z14.string()).optional(),
    markdown: MarkdownConfigSchema,
    configWrites: z14.boolean().optional(),
    sendReadReceipts: z14.boolean().optional(),
    messagePrefix: z14.string().optional(),
    responsePrefix: z14.string().optional(),
    dmPolicy: params.useDefaults ? DmPolicySchema.optional().default("pairing") : DmPolicySchema.optional(),
    selfChatMode: z14.boolean().optional(),
    allowFrom: z14.array(z14.string()).optional(),
    defaultTo: z14.string().optional(),
    groupAllowFrom: z14.array(z14.string()).optional(),
    groupPolicy: params.useDefaults ? GroupPolicySchema.optional().default("allowlist") : GroupPolicySchema.optional(),
    contextVisibility: ContextVisibilityModeSchema.optional(),
    historyLimit: z14.number().int().min(0).optional(),
    dmHistoryLimit: z14.number().int().min(0).optional(),
    dms: z14.record(z14.string(), DmConfigSchema.optional()).optional(),
    textChunkLimit: z14.number().int().positive().optional(),
    chunkMode: z14.enum(["length", "newline"]).optional(),
    blockStreaming: z14.boolean().optional(),
    blockStreamingCoalesce: BlockStreamingCoalesceSchema.optional(),
    groups: WhatsAppGroupsSchema,
    direct: WhatsAppDirectSchema,
    ackReaction: WhatsAppAckReactionSchema,
    reactionLevel: z14.enum(["off", "ack", "minimal", "extensive"]).optional(),
    debounceMs: params.useDefaults ? z14.number().int().nonnegative().optional().default(0) : z14.number().int().nonnegative().optional(),
    replyToMode: ReplyToModeSchema.optional(),
    heartbeat: ChannelHeartbeatVisibilitySchema,
    healthMonitor: ChannelHealthMonitorSchema
  };
}
function enforceOpenDmPolicyAllowFromStar(params) {
  if (params.dmPolicy !== "open") {
    return;
  }
  const allow = normalizeStringEntries(Array.isArray(params.allowFrom) ? params.allowFrom : []);
  if (allow.includes("*")) {
    return;
  }
  params.ctx.addIssue({
    code: z14.ZodIssueCode.custom,
    path: params.path ?? ["allowFrom"],
    message: params.message
  });
}
function enforceAllowlistDmPolicyAllowFrom(params) {
  if (params.dmPolicy !== "allowlist") {
    return;
  }
  const allow = normalizeStringEntries(Array.isArray(params.allowFrom) ? params.allowFrom : []);
  if (allow.length > 0) {
    return;
  }
  params.ctx.addIssue({
    code: z14.ZodIssueCode.custom,
    path: params.path ?? ["allowFrom"],
    message: params.message
  });
}
var WhatsAppAccountObjectSchema = z14.object({
  ...buildWhatsAppCommonShape({ useDefaults: false }),
  name: z14.string().optional(),
  enabled: z14.boolean().optional(),
  /** Override auth directory for this WhatsApp account (Baileys multi-file auth state). */
  authDir: z14.string().optional(),
  mediaMaxMb: z14.number().int().positive().optional()
}).strict();
var WhatsAppAccountSchema = z14.preprocess(
  stripDeprecatedWhatsAppNoopKeys,
  WhatsAppAccountObjectSchema
);
var WhatsAppConfigObjectSchema = z14.object({
  ...buildWhatsAppCommonShape({ useDefaults: true }),
  accounts: z14.record(z14.string(), WhatsAppAccountSchema.optional()).optional(),
  defaultAccount: z14.string().optional(),
  mediaMaxMb: z14.number().int().positive().optional().default(50),
  actions: z14.object({
    reactions: z14.boolean().optional(),
    sendMessage: z14.boolean().optional(),
    polls: z14.boolean().optional()
  }).strict().optional()
}).strict().superRefine((value, ctx) => {
  const defaultAccount = resolveAccountEntry(value.accounts, "default");
  enforceOpenDmPolicyAllowFromStar({
    dmPolicy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    message: 'channels.whatsapp.dmPolicy="open" requires channels.whatsapp.allowFrom to include "*"'
  });
  enforceAllowlistDmPolicyAllowFrom({
    dmPolicy: value.dmPolicy,
    allowFrom: value.allowFrom,
    ctx,
    message: 'channels.whatsapp.dmPolicy="allowlist" requires channels.whatsapp.allowFrom to contain at least one sender ID'
  });
  if (!value.accounts) {
    return;
  }
  for (const [accountId, account] of Object.entries(value.accounts)) {
    if (!account) {
      continue;
    }
    const effectivePolicy = account.dmPolicy ?? (accountId === "default" ? void 0 : defaultAccount?.dmPolicy) ?? value.dmPolicy;
    const effectiveAllowFrom = account.allowFrom ?? (accountId === "default" ? void 0 : defaultAccount?.allowFrom) ?? value.allowFrom;
    enforceOpenDmPolicyAllowFromStar({
      dmPolicy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.whatsapp.accounts.*.dmPolicy="open" requires channels.whatsapp.accounts.*.allowFrom (or channels.whatsapp.allowFrom) to include "*"'
    });
    enforceAllowlistDmPolicyAllowFrom({
      dmPolicy: effectivePolicy,
      allowFrom: effectiveAllowFrom,
      ctx,
      path: ["accounts", accountId, "allowFrom"],
      message: 'channels.whatsapp.accounts.*.dmPolicy="allowlist" requires channels.whatsapp.accounts.*.allowFrom (or channels.whatsapp.allowFrom) to contain at least one sender ID'
    });
  }
});
var WhatsAppConfigSchema = z14.preprocess(
  stripDeprecatedWhatsAppNoopKeys,
  WhatsAppConfigObjectSchema
);

// vendor/openclaw/src/config/zod-schema.providers.ts
var ChannelModelByChannelSchema = z15.record(z15.string(), z15.record(z15.string(), z15.string())).optional();
function addLegacyChannelAcpBindingIssues(value, ctx, path6 = []) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => addLegacyChannelAcpBindingIssues(entry, ctx, [...path6, index]));
    return;
  }
  const record = value;
  const bindings = record.bindings;
  if (bindings && typeof bindings === "object" && !Array.isArray(bindings)) {
    const acp = bindings.acp;
    if (acp && typeof acp === "object") {
      ctx.addIssue({
        code: z15.ZodIssueCode.custom,
        path: [...path6, "bindings", "acp"],
        message: "Legacy channel-local ACP bindings were removed; use top-level bindings[] entries."
      });
    }
  }
  for (const [key, entry] of Object.entries(record)) {
    addLegacyChannelAcpBindingIssues(entry, ctx, [...path6, key]);
  }
}
var ChannelsSchema = z15.object({
  defaults: z15.object({
    groupPolicy: GroupPolicySchema.optional(),
    contextVisibility: ContextVisibilityModeSchema.optional(),
    heartbeat: ChannelHeartbeatVisibilitySchema
  }).strict().optional(),
  modelByChannel: ChannelModelByChannelSchema
}).passthrough().superRefine((value, ctx) => {
  addLegacyChannelAcpBindingIssues(value, ctx);
}).optional();

// vendor/openclaw/src/config/zod-schema.proxy.ts
import { z as z16 } from "zod";
function isHttpProxyUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:";
  } catch {
    return false;
  }
}
var ProxyConfigSchema = z16.object({
  enabled: z16.boolean().optional(),
  proxyUrl: z16.string().url().refine(isHttpProxyUrl, {
    message: "proxyUrl must use http://"
  }).register(sensitive).optional()
}).strict().optional();

// vendor/openclaw/src/config/zod-schema.session.ts
import { z as z17 } from "zod";
var SessionResetConfigSchema = z17.object({
  mode: z17.union([z17.literal("daily"), z17.literal("idle")]).optional(),
  atHour: z17.number().int().min(0).max(23).optional(),
  idleMinutes: z17.number().int().positive().optional()
}).strict();
var SessionSendPolicySchema = createAllowDenyChannelRulesSchema();
var SessionSchema = z17.object({
  scope: z17.union([z17.literal("per-sender"), z17.literal("global")]).optional(),
  dmScope: z17.union([
    z17.literal("main"),
    z17.literal("per-peer"),
    z17.literal("per-channel-peer"),
    z17.literal("per-account-channel-peer")
  ]).optional(),
  identityLinks: z17.record(z17.string(), z17.array(z17.string())).optional(),
  resetTriggers: z17.array(z17.string()).optional(),
  idleMinutes: z17.number().int().positive().optional(),
  reset: SessionResetConfigSchema.optional(),
  resetByType: z17.object({
    direct: SessionResetConfigSchema.optional(),
    /** @deprecated Use `direct` instead. Kept for backward compatibility. */
    dm: SessionResetConfigSchema.optional(),
    group: SessionResetConfigSchema.optional(),
    thread: SessionResetConfigSchema.optional()
  }).strict().optional(),
  resetByChannel: z17.record(z17.string(), SessionResetConfigSchema).optional(),
  store: z17.string().optional(),
  typingIntervalSeconds: z17.number().int().positive().optional(),
  typingMode: TypingModeSchema.optional(),
  mainKey: z17.string().optional(),
  sendPolicy: SessionSendPolicySchema.optional(),
  writeLock: z17.object({
    acquireTimeoutMs: z17.number().int().positive().optional()
  }).strict().optional(),
  agentToAgent: z17.object({
    maxPingPongTurns: z17.number().int().min(0).max(5).optional()
  }).strict().optional(),
  threadBindings: z17.object({
    enabled: z17.boolean().optional(),
    idleHours: z17.number().nonnegative().optional(),
    maxAgeHours: z17.number().nonnegative().optional(),
    spawnSessions: z17.boolean().optional(),
    defaultSpawnContext: z17.enum(["isolated", "fork"]).optional()
  }).strict().optional(),
  maintenance: z17.object({
    mode: z17.enum(["enforce", "warn"]).optional(),
    pruneAfter: z17.union([z17.string(), z17.number()]).optional(),
    /** @deprecated Use pruneAfter instead. */
    pruneDays: z17.number().int().positive().optional(),
    maxEntries: z17.number().int().positive().optional(),
    rotateBytes: z17.union([z17.string(), z17.number()]).optional(),
    resetArchiveRetention: z17.union([z17.string(), z17.number(), z17.literal(false)]).optional(),
    maxDiskBytes: z17.union([z17.string(), z17.number()]).optional(),
    highWaterBytes: z17.union([z17.string(), z17.number()]).optional()
  }).strict().superRefine((val, ctx) => {
    if (val.pruneAfter !== void 0) {
      try {
        parseDurationMs(normalizeStringifiedOptionalString(val.pruneAfter) ?? "", {
          defaultUnit: "d"
        });
      } catch {
        ctx.addIssue({
          code: z17.ZodIssueCode.custom,
          path: ["pruneAfter"],
          message: "invalid duration (use ms, s, m, h, d)"
        });
      }
    }
    if (val.resetArchiveRetention !== void 0 && val.resetArchiveRetention !== false) {
      try {
        parseDurationMs(normalizeStringifiedOptionalString(val.resetArchiveRetention) ?? "", {
          defaultUnit: "d"
        });
      } catch {
        ctx.addIssue({
          code: z17.ZodIssueCode.custom,
          path: ["resetArchiveRetention"],
          message: "invalid duration (use ms, s, m, h, d)"
        });
      }
    }
    if (val.maxDiskBytes !== void 0) {
      try {
        parseByteSize(normalizeStringifiedOptionalString(val.maxDiskBytes) ?? "", {
          defaultUnit: "b"
        });
      } catch {
        ctx.addIssue({
          code: z17.ZodIssueCode.custom,
          path: ["maxDiskBytes"],
          message: "invalid size (use b, kb, mb, gb, tb)"
        });
      }
    }
    if (val.highWaterBytes !== void 0) {
      try {
        parseByteSize(normalizeStringifiedOptionalString(val.highWaterBytes) ?? "", {
          defaultUnit: "b"
        });
      } catch {
        ctx.addIssue({
          code: z17.ZodIssueCode.custom,
          path: ["highWaterBytes"],
          message: "invalid size (use b, kb, mb, gb, tb)"
        });
      }
    }
  }).optional()
}).strict().optional();
var MessagesSchema = z17.object({
  messagePrefix: z17.string().optional(),
  visibleReplies: VisibleRepliesSchema.optional(),
  responsePrefix: z17.string().optional(),
  groupChat: GroupChatSchema,
  queue: QueueSchema,
  inbound: InboundDebounceSchema,
  ackReaction: z17.string().optional(),
  ackReactionScope: z17.enum(["group-mentions", "group-all", "direct", "all", "off", "none"]).optional(),
  removeAckAfterReply: z17.boolean().optional(),
  statusReactions: z17.object({
    enabled: z17.boolean().optional(),
    emojis: z17.object({
      thinking: z17.string().optional(),
      tool: z17.string().optional(),
      coding: z17.string().optional(),
      web: z17.string().optional(),
      done: z17.string().optional(),
      error: z17.string().optional(),
      stallSoft: z17.string().optional(),
      stallHard: z17.string().optional(),
      compacting: z17.string().optional()
    }).strict().optional(),
    timing: z17.object({
      debounceMs: z17.number().int().min(0).optional(),
      stallSoftMs: z17.number().int().min(0).optional(),
      stallHardMs: z17.number().int().min(0).optional(),
      doneHoldMs: z17.number().int().min(0).optional(),
      errorHoldMs: z17.number().int().min(0).optional()
    }).strict().optional()
  }).strict().optional(),
  suppressToolErrors: z17.boolean().optional(),
  tts: TtsConfigSchema
}).strict().optional();
var CommandsSchema = z17.object({
  native: NativeCommandsSettingSchema.optional().default("auto"),
  nativeSkills: NativeCommandsSettingSchema.optional().default("auto"),
  text: z17.boolean().optional(),
  bash: z17.boolean().optional(),
  bashForegroundMs: z17.number().int().min(0).max(3e4).optional(),
  config: z17.boolean().optional(),
  mcp: z17.boolean().optional(),
  plugins: z17.boolean().optional(),
  debug: z17.boolean().optional(),
  restart: z17.boolean().optional().default(true),
  useAccessGroups: z17.boolean().optional(),
  ownerAllowFrom: z17.array(z17.union([z17.string(), z17.number()])).optional(),
  ownerDisplay: z17.enum(["raw", "hash"]).optional().default("raw"),
  ownerDisplaySecret: z17.string().optional().register(sensitive),
  allowFrom: ElevatedAllowFromSchema.optional()
}).strict().optional().default(
  () => ({
    native: "auto",
    nativeSkills: "auto",
    restart: true,
    ownerDisplay: "raw"
  })
);

// vendor/openclaw/src/config/zod-schema.ts
var BrowserSnapshotDefaultsSchema = z18.object({
  mode: z18.literal("efficient").optional()
}).strict().optional();
var NodeHostSchema = z18.object({
  browserProxy: z18.object({
    enabled: z18.boolean().optional(),
    allowProfiles: z18.array(z18.string()).optional()
  }).strict().optional()
}).strict().optional();
var AccessGroupsSchema = z18.record(
  z18.string().min(1),
  z18.discriminatedUnion("type", [
    z18.object({
      type: z18.literal("discord.channelAudience"),
      guildId: z18.string().min(1),
      channelId: z18.string().min(1),
      membership: z18.literal("canViewChannel").optional()
    }).strict(),
    z18.object({
      type: z18.literal("message.senders"),
      members: z18.record(z18.string().min(1), z18.array(z18.string().min(1)))
    }).strict()
  ])
).optional();
var MemoryQmdPathSchema = z18.object({
  path: z18.string(),
  name: z18.string().optional(),
  pattern: z18.string().optional()
}).strict();
var MemoryQmdSessionSchema = z18.object({
  enabled: z18.boolean().optional(),
  exportDir: z18.string().optional(),
  retentionDays: z18.number().int().nonnegative().optional()
}).strict();
var MemoryQmdUpdateSchema = z18.object({
  interval: z18.string().optional(),
  debounceMs: z18.number().int().nonnegative().optional(),
  onBoot: z18.boolean().optional(),
  startup: z18.enum(["off", "idle", "immediate"]).optional(),
  startupDelayMs: z18.number().int().nonnegative().optional(),
  waitForBootSync: z18.boolean().optional(),
  embedInterval: z18.string().optional(),
  commandTimeoutMs: z18.number().int().nonnegative().optional(),
  updateTimeoutMs: z18.number().int().nonnegative().optional(),
  embedTimeoutMs: z18.number().int().nonnegative().optional()
}).strict();
var MemoryQmdLimitsSchema = z18.object({
  maxResults: z18.number().int().positive().optional(),
  maxSnippetChars: z18.number().int().positive().optional(),
  maxInjectedChars: z18.number().int().positive().optional(),
  timeoutMs: z18.number().int().nonnegative().optional()
}).strict();
var MemoryQmdMcporterSchema = z18.object({
  enabled: z18.boolean().optional(),
  serverName: z18.string().optional(),
  startDaemon: z18.boolean().optional()
}).strict();
var LoggingLevelSchema = z18.union([
  z18.literal("silent"),
  z18.literal("fatal"),
  z18.literal("error"),
  z18.literal("warn"),
  z18.literal("info"),
  z18.literal("debug"),
  z18.literal("trace")
]);
var MemoryQmdSchema = z18.object({
  command: z18.string().optional(),
  mcporter: MemoryQmdMcporterSchema.optional(),
  searchMode: z18.union([z18.literal("query"), z18.literal("search"), z18.literal("vsearch")]).optional(),
  searchTool: z18.string().trim().min(1).optional(),
  includeDefaultMemory: z18.boolean().optional(),
  paths: z18.array(MemoryQmdPathSchema).optional(),
  sessions: MemoryQmdSessionSchema.optional(),
  update: MemoryQmdUpdateSchema.optional(),
  limits: MemoryQmdLimitsSchema.optional(),
  scope: SessionSendPolicySchema.optional()
}).strict();
var MemorySchema = z18.object({
  backend: z18.union([z18.literal("builtin"), z18.literal("qmd")]).optional(),
  citations: z18.union([z18.literal("auto"), z18.literal("on"), z18.literal("off")]).optional(),
  qmd: MemoryQmdSchema.optional()
}).strict().optional();
var HttpUrlSchema = z18.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Expected http:// or https:// URL");
var ResponsesEndpointUrlFetchShape = {
  allowUrl: z18.boolean().optional(),
  urlAllowlist: z18.array(z18.string()).optional(),
  allowedMimes: z18.array(z18.string()).optional(),
  maxBytes: z18.number().int().positive().optional(),
  maxRedirects: z18.number().int().nonnegative().optional(),
  timeoutMs: z18.number().int().positive().optional()
};
var SkillEntrySchema = z18.object({
  enabled: z18.boolean().optional(),
  apiKey: SecretInputSchema.optional().register(sensitive),
  env: z18.record(z18.string(), z18.string()).optional(),
  config: z18.record(z18.string(), z18.unknown()).optional()
}).strict();
var PluginEntrySchema = z18.object({
  enabled: z18.boolean().optional(),
  hooks: z18.object({
    allowPromptInjection: z18.boolean().optional(),
    allowConversationAccess: z18.boolean().optional(),
    timeoutMs: z18.number().int().positive().max(6e5).optional(),
    timeouts: z18.record(z18.string(), z18.number().int().positive().max(6e5)).optional()
  }).strict().optional(),
  subagent: z18.object({
    allowModelOverride: z18.boolean().optional(),
    allowedModels: z18.array(z18.string()).optional()
  }).strict().optional(),
  config: z18.record(z18.string(), z18.unknown()).optional()
}).strict();
var TalkProviderEntrySchema = z18.object({
  apiKey: SecretInputSchema.optional().register(sensitive)
}).catchall(z18.unknown());
var TalkSchema = z18.object({
  provider: z18.string().optional(),
  providers: z18.record(z18.string(), TalkProviderEntrySchema).optional(),
  speechLocale: z18.string().optional(),
  interruptOnSpeech: z18.boolean().optional(),
  silenceTimeoutMs: z18.number().int().positive().optional()
}).strict().superRefine((talk, ctx) => {
  const provider = normalizeLowercaseStringOrEmpty(talk.provider ?? "");
  const providers = talk.providers ? Object.keys(talk.providers) : [];
  if (provider && providers.length > 0 && !(provider in talk.providers)) {
    ctx.addIssue({
      code: z18.ZodIssueCode.custom,
      path: ["provider"],
      message: `talk.provider must match a key in talk.providers (missing "${provider}")`
    });
  }
  if (!provider && providers.length > 1) {
    ctx.addIssue({
      code: z18.ZodIssueCode.custom,
      path: ["provider"],
      message: "talk.provider is required when talk.providers defines multiple providers"
    });
  }
});
var McpServerSchema = z18.object({
  command: z18.string().optional(),
  args: z18.array(z18.string()).optional(),
  env: z18.record(z18.string(), z18.union([z18.string(), z18.number(), z18.boolean()])).optional(),
  cwd: z18.string().optional(),
  workingDirectory: z18.string().optional(),
  url: HttpUrlSchema.optional(),
  transport: z18.union([z18.literal("sse"), z18.literal("streamable-http")]).optional(),
  headers: z18.record(
    z18.string(),
    z18.union([z18.string().register(sensitive), z18.number(), z18.boolean()]).register(sensitive)
  ).optional()
}).catchall(z18.unknown());
var McpConfigSchema = z18.object({
  servers: z18.record(z18.string(), McpServerSchema).optional(),
  sessionIdleTtlMs: z18.number().finite().min(0).optional()
}).strict().optional();
var CrestodianSchema = z18.object({
  rescue: z18.object({
    enabled: z18.union([z18.literal("auto"), z18.boolean()]).optional(),
    ownerDmOnly: z18.boolean().optional(),
    pendingTtlMinutes: z18.number().int().positive().optional()
  }).strict().optional()
}).strict().optional();
var CommitmentsSchema = z18.object({
  enabled: z18.boolean().optional(),
  maxPerDay: z18.number().int().positive().optional()
}).strict().optional();
var OpenClawSchema = z18.object({
  $schema: z18.string().optional(),
  meta: z18.object({
    lastTouchedVersion: z18.string().optional(),
    // Accept any string unchanged (backwards-compatible) and coerce numeric Unix
    // timestamps to ISO strings (agent file edits may write Date.now()).
    lastTouchedAt: z18.union([
      z18.string(),
      z18.number().transform((n, ctx) => {
        const d = new Date(n);
        if (Number.isNaN(d.getTime())) {
          ctx.addIssue({ code: z18.ZodIssueCode.custom, message: "Invalid timestamp" });
          return z18.NEVER;
        }
        return d.toISOString();
      })
    ]).optional()
  }).strict().optional(),
  env: z18.object({
    shellEnv: z18.object({
      enabled: z18.boolean().optional(),
      timeoutMs: z18.number().int().nonnegative().optional()
    }).strict().optional(),
    vars: z18.record(z18.string(), z18.string()).optional()
  }).catchall(z18.string()).optional(),
  wizard: z18.object({
    lastRunAt: z18.string().optional(),
    lastRunVersion: z18.string().optional(),
    lastRunCommit: z18.string().optional(),
    lastRunCommand: z18.string().optional(),
    lastRunMode: z18.union([z18.literal("local"), z18.literal("remote")]).optional()
  }).strict().optional(),
  diagnostics: z18.object({
    enabled: z18.boolean().optional(),
    flags: z18.array(z18.string()).optional(),
    stuckSessionWarnMs: z18.number().int().positive().optional(),
    otel: z18.object({
      enabled: z18.boolean().optional(),
      endpoint: z18.string().optional(),
      tracesEndpoint: z18.string().optional(),
      metricsEndpoint: z18.string().optional(),
      logsEndpoint: z18.string().optional(),
      protocol: z18.union([z18.literal("http/protobuf"), z18.literal("grpc")]).optional(),
      headers: z18.record(z18.string(), z18.string()).optional(),
      serviceName: z18.string().optional(),
      traces: z18.boolean().optional(),
      metrics: z18.boolean().optional(),
      logs: z18.boolean().optional(),
      sampleRate: z18.number().min(0).max(1).optional(),
      flushIntervalMs: z18.number().int().nonnegative().optional(),
      captureContent: z18.union([
        z18.boolean(),
        z18.object({
          enabled: z18.boolean().optional(),
          inputMessages: z18.boolean().optional(),
          outputMessages: z18.boolean().optional(),
          toolInputs: z18.boolean().optional(),
          toolOutputs: z18.boolean().optional(),
          systemPrompt: z18.boolean().optional()
        }).strict()
      ]).optional()
    }).strict().optional(),
    cacheTrace: z18.object({
      enabled: z18.boolean().optional(),
      filePath: z18.string().optional(),
      includeMessages: z18.boolean().optional(),
      includePrompt: z18.boolean().optional(),
      includeSystem: z18.boolean().optional()
    }).strict().optional()
  }).strict().optional(),
  logging: z18.object({
    level: LoggingLevelSchema.optional(),
    file: z18.string().optional(),
    maxFileBytes: z18.number().int().positive().optional(),
    consoleLevel: LoggingLevelSchema.optional(),
    consoleStyle: z18.union([z18.literal("pretty"), z18.literal("compact"), z18.literal("json")]).optional(),
    redactSensitive: z18.union([z18.literal("off"), z18.literal("tools")]).optional(),
    redactPatterns: z18.array(z18.string()).optional()
  }).strict().optional(),
  cli: z18.object({
    banner: z18.object({
      taglineMode: z18.union([z18.literal("random"), z18.literal("default"), z18.literal("off")]).optional()
    }).strict().optional()
  }).strict().optional(),
  crestodian: CrestodianSchema,
  update: z18.object({
    channel: z18.union([z18.literal("stable"), z18.literal("beta"), z18.literal("dev")]).optional(),
    checkOnStart: z18.boolean().optional(),
    auto: z18.object({
      enabled: z18.boolean().optional(),
      stableDelayHours: z18.number().nonnegative().max(168).optional(),
      stableJitterHours: z18.number().nonnegative().max(168).optional(),
      betaCheckIntervalHours: z18.number().positive().max(24).optional()
    }).strict().optional()
  }).strict().optional(),
  browser: z18.object({
    enabled: z18.boolean().optional(),
    evaluateEnabled: z18.boolean().optional(),
    cdpUrl: z18.string().optional(),
    remoteCdpTimeoutMs: z18.number().int().nonnegative().optional(),
    remoteCdpHandshakeTimeoutMs: z18.number().int().nonnegative().optional(),
    localLaunchTimeoutMs: z18.number().int().positive().max(12e4).optional(),
    localCdpReadyTimeoutMs: z18.number().int().positive().max(12e4).optional(),
    actionTimeoutMs: z18.number().int().positive().optional(),
    color: z18.string().optional(),
    executablePath: z18.string().optional(),
    headless: z18.boolean().optional(),
    noSandbox: z18.boolean().optional(),
    attachOnly: z18.boolean().optional(),
    cdpPortRangeStart: z18.number().int().min(1).max(65535).optional(),
    defaultProfile: z18.string().optional(),
    snapshotDefaults: BrowserSnapshotDefaultsSchema,
    ssrfPolicy: z18.object({
      dangerouslyAllowPrivateNetwork: z18.boolean().optional(),
      allowedHostnames: z18.array(z18.string()).optional(),
      hostnameAllowlist: z18.array(z18.string()).optional()
    }).strict().optional(),
    profiles: z18.record(
      z18.string().regex(/^[a-z0-9-]+$/, "Profile names must be alphanumeric with hyphens only"),
      z18.object({
        cdpPort: z18.number().int().min(1).max(65535).optional(),
        cdpUrl: z18.string().optional(),
        userDataDir: z18.string().optional(),
        mcpCommand: z18.string().optional(),
        mcpArgs: z18.array(z18.string()).optional(),
        driver: z18.union([z18.literal("openclaw"), z18.literal("clawd"), z18.literal("existing-session")]).optional(),
        headless: z18.boolean().optional(),
        executablePath: z18.string().optional(),
        attachOnly: z18.boolean().optional(),
        color: HexColorSchema
      }).strict().refine(
        (value) => value.driver === "existing-session" || value.cdpPort || value.cdpUrl,
        {
          message: "Profile must set cdpPort or cdpUrl"
        }
      ).refine((value) => value.driver === "existing-session" || !value.userDataDir, {
        message: 'Profile userDataDir is only supported with driver="existing-session"'
      })
    ).optional(),
    extraArgs: z18.array(z18.string()).optional(),
    tabCleanup: z18.object({
      enabled: z18.boolean().optional(),
      idleMinutes: z18.number().int().nonnegative().optional(),
      maxTabsPerSession: z18.number().int().nonnegative().optional(),
      sweepMinutes: z18.number().int().positive().optional()
    }).strict().optional()
  }).strict().optional(),
  ui: z18.object({
    seamColor: HexColorSchema.optional(),
    assistant: z18.object({
      name: z18.string().max(50).optional(),
      avatar: z18.string().max(2e6).optional()
    }).strict().optional()
  }).strict().optional(),
  secrets: SecretsConfigSchema,
  auth: z18.object({
    profiles: z18.record(
      z18.string(),
      z18.object({
        provider: z18.string(),
        mode: z18.union([z18.literal("api_key"), z18.literal("oauth"), z18.literal("token")]),
        email: z18.string().optional(),
        displayName: z18.string().optional()
      }).strict()
    ).optional(),
    order: z18.record(z18.string(), z18.array(z18.string())).optional(),
    cooldowns: z18.object({
      billingBackoffHours: z18.number().positive().optional(),
      billingBackoffHoursByProvider: z18.record(z18.string(), z18.number().positive()).optional(),
      billingMaxHours: z18.number().positive().optional(),
      authPermanentBackoffMinutes: z18.number().positive().optional(),
      authPermanentMaxMinutes: z18.number().positive().optional(),
      failureWindowHours: z18.number().positive().optional(),
      overloadedProfileRotations: z18.number().int().nonnegative().optional(),
      overloadedBackoffMs: z18.number().int().nonnegative().optional(),
      rateLimitedProfileRotations: z18.number().int().nonnegative().optional()
    }).strict().optional()
  }).strict().optional(),
  accessGroups: AccessGroupsSchema,
  acp: z18.object({
    enabled: z18.boolean().optional(),
    dispatch: z18.object({
      enabled: z18.boolean().optional()
    }).strict().optional(),
    backend: z18.string().optional(),
    defaultAgent: z18.string().optional(),
    allowedAgents: z18.array(z18.string()).optional(),
    maxConcurrentSessions: z18.number().int().positive().optional(),
    stream: z18.object({
      coalesceIdleMs: z18.number().int().nonnegative().optional(),
      maxChunkChars: z18.number().int().positive().optional(),
      repeatSuppression: z18.boolean().optional(),
      deliveryMode: z18.union([z18.literal("live"), z18.literal("final_only")]).optional(),
      hiddenBoundarySeparator: z18.union([
        z18.literal("none"),
        z18.literal("space"),
        z18.literal("newline"),
        z18.literal("paragraph")
      ]).optional(),
      maxOutputChars: z18.number().int().positive().optional(),
      maxSessionUpdateChars: z18.number().int().positive().optional(),
      tagVisibility: z18.record(z18.string(), z18.boolean()).optional()
    }).strict().optional(),
    runtime: z18.object({
      ttlMinutes: z18.number().int().positive().optional(),
      installCommand: z18.string().optional()
    }).strict().optional()
  }).strict().optional(),
  models: ModelsConfigSchema,
  nodeHost: NodeHostSchema,
  agents: AgentsSchema,
  tools: ToolsSchema,
  bindings: BindingsSchema,
  broadcast: BroadcastSchema,
  audio: AudioSchema,
  media: z18.object({
    preserveFilenames: z18.boolean().optional(),
    ttlHours: z18.number().int().min(1).max(24 * 7).optional()
  }).strict().optional(),
  messages: MessagesSchema,
  commands: CommandsSchema,
  approvals: ApprovalsSchema,
  session: SessionSchema,
  cron: z18.object({
    enabled: z18.boolean().optional(),
    store: z18.string().optional(),
    maxConcurrentRuns: z18.number().int().positive().optional(),
    retry: z18.object({
      maxAttempts: z18.number().int().min(0).max(10).optional(),
      backoffMs: z18.array(z18.number().int().nonnegative()).min(1).max(10).optional(),
      retryOn: z18.array(z18.enum(["rate_limit", "overloaded", "network", "timeout", "server_error"])).min(1).optional()
    }).strict().optional(),
    webhook: HttpUrlSchema.optional(),
    webhookToken: SecretInputSchema.optional().register(sensitive),
    sessionRetention: z18.union([z18.string(), z18.literal(false)]).optional(),
    runLog: z18.object({
      maxBytes: z18.union([z18.string(), z18.number()]).optional(),
      keepLines: z18.number().int().positive().optional()
    }).strict().optional(),
    failureAlert: z18.object({
      enabled: z18.boolean().optional(),
      after: z18.number().int().min(1).optional(),
      cooldownMs: z18.number().int().min(0).optional(),
      includeSkipped: z18.boolean().optional(),
      mode: z18.enum(["announce", "webhook"]).optional(),
      accountId: z18.string().optional()
    }).strict().optional(),
    failureDestination: z18.object({
      channel: z18.string().optional(),
      to: z18.string().optional(),
      accountId: z18.string().optional(),
      mode: z18.enum(["announce", "webhook"]).optional()
    }).strict().optional()
  }).strict().superRefine((val, ctx) => {
    if (val.sessionRetention !== void 0 && val.sessionRetention !== false) {
      try {
        parseDurationMs(normalizeStringifiedOptionalString(val.sessionRetention) ?? "", {
          defaultUnit: "h"
        });
      } catch {
        ctx.addIssue({
          code: z18.ZodIssueCode.custom,
          path: ["sessionRetention"],
          message: "invalid duration (use ms, s, m, h, d)"
        });
      }
    }
    if (val.runLog?.maxBytes !== void 0) {
      try {
        parseByteSize(normalizeStringifiedOptionalString(val.runLog.maxBytes) ?? "", {
          defaultUnit: "b"
        });
      } catch {
        ctx.addIssue({
          code: z18.ZodIssueCode.custom,
          path: ["runLog", "maxBytes"],
          message: "invalid size (use b, kb, mb, gb, tb)"
        });
      }
    }
  }).optional(),
  commitments: CommitmentsSchema,
  hooks: z18.object({
    enabled: z18.boolean().optional(),
    path: z18.string().optional(),
    token: z18.string().optional().register(sensitive),
    defaultSessionKey: z18.string().optional(),
    allowRequestSessionKey: z18.boolean().optional(),
    allowedSessionKeyPrefixes: z18.array(z18.string()).optional(),
    allowedAgentIds: z18.array(z18.string()).optional(),
    maxBodyBytes: z18.number().int().positive().optional(),
    presets: z18.array(z18.string()).optional(),
    transformsDir: z18.string().optional(),
    mappings: z18.array(HookMappingSchema).optional(),
    gmail: HooksGmailSchema,
    internal: InternalHooksSchema
  }).strict().optional(),
  web: z18.object({
    enabled: z18.boolean().optional(),
    heartbeatSeconds: z18.number().int().positive().optional(),
    reconnect: z18.object({
      initialMs: z18.number().positive().optional(),
      maxMs: z18.number().positive().optional(),
      factor: z18.number().positive().optional(),
      jitter: z18.number().min(0).max(1).optional(),
      maxAttempts: z18.number().int().min(0).optional()
    }).strict().optional(),
    whatsapp: z18.object({
      keepAliveIntervalMs: z18.number().int().positive().optional(),
      connectTimeoutMs: z18.number().int().positive().optional(),
      defaultQueryTimeoutMs: z18.number().int().positive().optional()
    }).strict().optional()
  }).strict().optional(),
  channels: ChannelsSchema,
  discovery: z18.object({
    wideArea: z18.object({
      enabled: z18.boolean().optional(),
      domain: z18.string().optional()
    }).strict().optional(),
    mdns: z18.object({
      mode: z18.enum(["off", "minimal", "full"]).optional()
    }).strict().optional()
  }).strict().optional(),
  canvasHost: z18.object({
    enabled: z18.boolean().optional(),
    root: z18.string().optional(),
    port: z18.number().int().positive().optional(),
    liveReload: z18.boolean().optional()
  }).strict().optional(),
  talk: TalkSchema.optional(),
  gateway: z18.object({
    port: z18.number().int().positive().optional(),
    mode: z18.union([z18.literal("local"), z18.literal("remote")]).optional(),
    bind: z18.union([
      z18.literal("auto"),
      z18.literal("lan"),
      z18.literal("loopback"),
      z18.literal("custom"),
      z18.literal("tailnet")
    ]).optional(),
    customBindHost: z18.string().optional(),
    controlUi: z18.object({
      enabled: z18.boolean().optional(),
      basePath: z18.string().optional(),
      root: z18.string().optional(),
      embedSandbox: z18.union([z18.literal("strict"), z18.literal("scripts"), z18.literal("trusted")]).optional(),
      allowExternalEmbedUrls: z18.boolean().optional(),
      chatMessageMaxWidth: z18.string().transform((value) => normalizeControlUiChatMessageMaxWidth(value)).refine((value) => isValidControlUiChatMessageMaxWidth(value), {
        message: "Expected a CSS width value such as 960px, 82%, min(1280px, 82%), or calc(100% - 2rem)"
      }).optional(),
      allowedOrigins: z18.array(z18.string()).optional(),
      dangerouslyAllowHostHeaderOriginFallback: z18.boolean().optional(),
      allowInsecureAuth: z18.boolean().optional(),
      dangerouslyDisableDeviceAuth: z18.boolean().optional()
    }).strict().optional(),
    auth: z18.object({
      mode: z18.union([
        z18.literal("none"),
        z18.literal("token"),
        z18.literal("password"),
        z18.literal("trusted-proxy")
      ]).optional(),
      token: SecretInputSchema.optional().register(sensitive),
      password: SecretInputSchema.optional().register(sensitive),
      allowTailscale: z18.boolean().optional(),
      rateLimit: z18.object({
        maxAttempts: z18.number().optional(),
        windowMs: z18.number().optional(),
        lockoutMs: z18.number().optional(),
        exemptLoopback: z18.boolean().optional()
      }).strict().optional(),
      trustedProxy: z18.object({
        userHeader: z18.string().min(1, "userHeader is required for trusted-proxy mode"),
        requiredHeaders: z18.array(z18.string()).optional(),
        allowUsers: z18.array(z18.string()).optional(),
        allowLoopback: z18.boolean().optional()
      }).strict().optional()
    }).strict().optional(),
    trustedProxies: z18.array(z18.string()).optional(),
    allowRealIpFallback: z18.boolean().optional(),
    tools: z18.object({
      deny: z18.array(z18.string()).optional(),
      allow: z18.array(z18.string()).optional()
    }).strict().optional(),
    webchat: z18.object({
      chatHistoryMaxChars: z18.number().int().positive().max(5e5).optional()
    }).strict().optional(),
    handshakeTimeoutMs: z18.number().int().min(1).optional(),
    channelHealthCheckMinutes: z18.number().int().min(0).optional(),
    channelStaleEventThresholdMinutes: z18.number().int().min(1).optional(),
    channelMaxRestartsPerHour: z18.number().int().min(1).optional(),
    tailscale: z18.object({
      mode: z18.union([z18.literal("off"), z18.literal("serve"), z18.literal("funnel")]).optional(),
      resetOnExit: z18.boolean().optional()
    }).strict().optional(),
    remote: z18.object({
      url: z18.string().optional(),
      transport: z18.union([z18.literal("ssh"), z18.literal("direct")]).optional(),
      token: SecretInputSchema.optional().register(sensitive),
      password: SecretInputSchema.optional().register(sensitive),
      tlsFingerprint: z18.string().optional(),
      sshTarget: z18.string().optional(),
      sshIdentity: z18.string().optional()
    }).strict().optional(),
    reload: z18.object({
      mode: z18.union([
        z18.literal("off"),
        z18.literal("restart"),
        z18.literal("hot"),
        z18.literal("hybrid")
      ]).optional(),
      debounceMs: z18.number().int().min(0).optional(),
      deferralTimeoutMs: z18.number().int().min(0).optional()
    }).strict().optional(),
    tls: z18.object({
      enabled: z18.boolean().optional(),
      autoGenerate: z18.boolean().optional(),
      certPath: z18.string().optional(),
      keyPath: z18.string().optional(),
      caPath: z18.string().optional()
    }).optional(),
    http: z18.object({
      endpoints: z18.object({
        chatCompletions: z18.object({
          enabled: z18.boolean().optional(),
          maxBodyBytes: z18.number().int().positive().optional(),
          maxImageParts: z18.number().int().nonnegative().optional(),
          maxTotalImageBytes: z18.number().int().positive().optional(),
          images: z18.object({
            ...ResponsesEndpointUrlFetchShape
          }).strict().optional()
        }).strict().optional(),
        responses: z18.object({
          enabled: z18.boolean().optional(),
          maxBodyBytes: z18.number().int().positive().optional(),
          maxUrlParts: z18.number().int().nonnegative().optional(),
          files: z18.object({
            ...ResponsesEndpointUrlFetchShape,
            maxChars: z18.number().int().positive().optional(),
            pdf: z18.object({
              maxPages: z18.number().int().positive().optional(),
              maxPixels: z18.number().int().positive().optional(),
              minTextChars: z18.number().int().nonnegative().optional()
            }).strict().optional()
          }).strict().optional(),
          images: z18.object({
            ...ResponsesEndpointUrlFetchShape
          }).strict().optional()
        }).strict().optional()
      }).strict().optional(),
      securityHeaders: z18.object({
        strictTransportSecurity: z18.union([z18.string(), z18.literal(false)]).optional()
      }).strict().optional()
    }).strict().optional(),
    push: z18.object({
      apns: z18.object({
        relay: z18.object({
          baseUrl: z18.string().optional(),
          timeoutMs: z18.number().int().positive().optional()
        }).strict().optional()
      }).strict().optional()
    }).strict().optional(),
    nodes: z18.object({
      browser: z18.object({
        mode: z18.union([z18.literal("auto"), z18.literal("manual"), z18.literal("off")]).optional(),
        node: z18.string().optional()
      }).strict().optional(),
      pairing: z18.object({
        autoApproveCidrs: z18.array(z18.string()).optional()
      }).strict().optional(),
      allowCommands: z18.array(z18.string()).optional(),
      denyCommands: z18.array(z18.string()).optional()
    }).strict().optional()
  }).strict().superRefine((gateway, ctx) => {
    const effectiveHealthCheckMinutes = gateway.channelHealthCheckMinutes ?? 5;
    if (gateway.channelStaleEventThresholdMinutes != null && effectiveHealthCheckMinutes !== 0 && gateway.channelStaleEventThresholdMinutes < effectiveHealthCheckMinutes) {
      ctx.addIssue({
        code: z18.ZodIssueCode.custom,
        path: ["channelStaleEventThresholdMinutes"],
        message: "channelStaleEventThresholdMinutes should be >= channelHealthCheckMinutes to avoid delayed stale detection"
      });
    }
  }).optional(),
  memory: MemorySchema,
  mcp: McpConfigSchema,
  skills: z18.object({
    allowBundled: z18.array(z18.string()).optional(),
    load: z18.object({
      extraDirs: z18.array(z18.string()).optional(),
      watch: z18.boolean().optional(),
      watchDebounceMs: z18.number().int().min(0).optional()
    }).strict().optional(),
    install: z18.object({
      preferBrew: z18.boolean().optional(),
      nodeManager: z18.union([z18.literal("npm"), z18.literal("pnpm"), z18.literal("yarn"), z18.literal("bun")]).optional()
    }).strict().optional(),
    limits: z18.object({
      maxCandidatesPerRoot: z18.number().int().min(1).optional(),
      maxSkillsLoadedPerSource: z18.number().int().min(1).optional(),
      maxSkillsInPrompt: z18.number().int().min(0).optional(),
      maxSkillsPromptChars: z18.number().int().min(0).optional(),
      maxSkillFileBytes: z18.number().int().min(0).optional()
    }).strict().optional(),
    entries: z18.record(z18.string(), SkillEntrySchema).optional()
  }).strict().optional(),
  plugins: z18.object({
    enabled: z18.boolean().optional(),
    allow: z18.array(z18.string()).optional(),
    deny: z18.array(z18.string()).optional(),
    load: z18.object({
      paths: z18.array(z18.string()).optional()
    }).strict().optional(),
    slots: z18.object({
      memory: z18.string().optional(),
      contextEngine: z18.string().optional()
    }).strict().optional(),
    entries: z18.record(z18.string(), PluginEntrySchema).optional(),
    bundledDiscovery: z18.enum(["compat", "allowlist"]).optional()
  }).strict().optional(),
  surfaces: z18.record(
    z18.string(),
    z18.object({
      silentReply: SilentReplyPolicyConfigSchema.optional(),
      silentReplyRewrite: SilentReplyRewriteConfigSchema.optional()
    }).strict()
  ).optional(),
  proxy: ProxyConfigSchema
}).strict().superRefine((cfg, ctx) => {
  const agents = cfg.agents?.list ?? [];
  if (agents.length === 0) {
    return;
  }
  const agentIds = new Set(agents.map((agent) => agent.id));
  const broadcast = cfg.broadcast;
  if (!broadcast) {
    return;
  }
  for (const [peerId, ids] of Object.entries(broadcast)) {
    if (peerId === "strategy") {
      continue;
    }
    if (!Array.isArray(ids)) {
      continue;
    }
    for (let idx = 0; idx < ids.length; idx += 1) {
      const agentId = ids[idx];
      if (!agentIds.has(agentId)) {
        ctx.addIssue({
          code: z18.ZodIssueCode.custom,
          path: ["broadcast", peerId, idx],
          message: `Unknown agent id "${agentId}" (not in agents.list).`
        });
      }
    }
  }
});
export {
  OpenClawSchema
};
