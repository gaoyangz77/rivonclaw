export interface ChannelFieldConfig {
  id: string;                    // Field ID (e.g., "appId")
  label: string;                 // i18n key for label
  type: "text" | "password" | "number" | "select" | "textarea" | "tags";
  required: boolean;
  placeholder?: string;          // i18n key for placeholder
  hint?: string;                 // i18n key for hint text
  isSecret?: boolean;            // Store in secrets (vs config)
  defaultValue?: string | number;
  options?: Array<{value: string; label: string}>; // For select fields
  showWhen?: { field: string; value: string | string[] }; // Conditional visibility
}

export interface ChannelSchema {
  fields: ChannelFieldConfig[];
  commonFields?: {               // Common fields like enabled
    enabled?: boolean;
  };
}

// Shared dmPolicy options: pairing, allowlist, disabled (excludes "open" for security)
const DM_POLICY_OPTIONS: ChannelFieldConfig["options"] = [
  { value: "pairing", label: "channels.dmPolicyPairing" },
  { value: "allowlist", label: "channels.dmPolicyAllowlist" },
  // { value: "open", label: "channels.dmPolicyOpen" }, // Disabled — security risk: allows any stranger to chat without approval
  { value: "disabled", label: "channels.dmPolicyDisabled" },
];

// Feishu variant: no "disabled" option, vendor schema only supports open/pairing/allowlist
const DM_POLICY_OPTIONS_NO_DISABLED: ChannelFieldConfig["options"] = [
  { value: "pairing", label: "channels.dmPolicyPairing" },
  { value: "allowlist", label: "channels.dmPolicyAllowlist" },
  // { value: "open", label: "channels.dmPolicyOpen" }, // Disabled — security risk
];

// Shared groupPolicy options
const GROUP_POLICY_OPTIONS: ChannelFieldConfig["options"] = [
  { value: "open", label: "channels.groupPolicyOpen" },
  { value: "allowlist", label: "channels.groupPolicyAllowlist" },
  { value: "disabled", label: "channels.groupPolicyDisabled" },
];

function dmPolicyField(options: ChannelFieldConfig["options"] = DM_POLICY_OPTIONS): ChannelFieldConfig {
  return {
    id: "dmPolicy",
    label: "channels.fieldDmPolicy",
    type: "select",
    required: false,
    defaultValue: "pairing",
    options,
  };
}

function groupPolicyField(): ChannelFieldConfig {
  return {
    id: "groupPolicy",
    label: "channels.fieldGroupPolicy",
    type: "select",
    required: false,
    defaultValue: "open",
    options: GROUP_POLICY_OPTIONS,
    hint: "channels.fieldGroupPolicyHint",
  };
}

function groupAllowedGroupsField(hint: string): ChannelFieldConfig {
  return {
    id: "groups",
    label: "channels.fieldAllowedGroups",
    type: "tags",
    required: false,
    placeholder: "channels.fieldAllowedGroupsPlaceholder",
    hint,
    showWhen: { field: "groupPolicy", value: "allowlist" },
  };
}

function groupAllowFromField(hint: string): ChannelFieldConfig {
  return {
    id: "groupAllowFrom",
    label: "channels.fieldGroupAllowFrom",
    type: "tags",
    required: false,
    placeholder: "channels.fieldGroupAllowFromPlaceholder",
    hint,
    showWhen: { field: "groupPolicy", value: "allowlist" },
  };
}

export const CHANNEL_SCHEMAS: Record<string, ChannelSchema> = {
  telegram: {
    fields: [
      {
        id: "botToken",
        label: "channels.fieldBotToken",
        type: "password",
        required: true,
        placeholder: "channels.fieldBotTokenPlaceholder",
        hint: "channels.fieldBotTokenHintCreate",
        isSecret: true,
      },
      {
        id: "webhookUrl",
        label: "channels.fieldWebhookUrl",
        type: "text",
        required: false,
        placeholder: "channels.fieldWebhookUrlPlaceholder",
        hint: "channels.fieldWebhookUrlHint",
      },
      dmPolicyField(),
      groupPolicyField(),
      groupAllowedGroupsField("channels.telegramAllowedGroupsHint"),
      groupAllowFromField("channels.telegramGroupAllowFromHint"),
    ],
    commonFields: { enabled: true },
  },

  feishu: {
    fields: [
      {
        id: "appId",
        label: "channels.feishuAppId",
        type: "text",
        required: true,
        placeholder: "channels.feishuAppIdPlaceholder",
        hint: "channels.feishuAppIdHint",
      },
      {
        id: "appSecret",
        label: "channels.feishuAppSecret",
        type: "password",
        required: true,
        placeholder: "channels.feishuAppSecretPlaceholder",
        hint: "channels.feishuAppSecretHint",
        isSecret: true,
      },
      {
        id: "domain",
        label: "channels.feishuDomain",
        type: "select",
        required: false,
        defaultValue: "feishu",
        options: [
          { value: "feishu", label: "Feishu (飞书)" },
          { value: "lark", label: "Lark (海外版)" },
        ],
        hint: "channels.feishuDomainHint",
      },
      {
        id: "connectionMode",
        label: "channels.feishuConnectionMode",
        type: "select",
        required: false,
        defaultValue: "websocket",
        options: [
          { value: "websocket", label: "WebSocket" },
          { value: "webhook", label: "Webhook" },
        ],
      },
      {
        id: "verificationToken",
        label: "channels.feishuVerificationToken",
        type: "password",
        required: false,
        placeholder: "channels.feishuVerificationTokenPlaceholder",
        hint: "channels.feishuVerificationTokenHint",
        isSecret: true,
        showWhen: { field: "connectionMode", value: "webhook" },
      },
      {
        id: "encryptKey",
        label: "channels.feishuEncryptKey",
        type: "password",
        required: false,
        placeholder: "channels.feishuEncryptKeyPlaceholder",
        hint: "channels.feishuEncryptKeyHint",
        isSecret: true,
        showWhen: { field: "connectionMode", value: "webhook" },
      },
      dmPolicyField(DM_POLICY_OPTIONS_NO_DISABLED),
      {
        id: "groupPolicy",
        label: "channels.fieldGroupPolicy",
        type: "select",
        required: false,
        defaultValue: "allowlist",
        options: GROUP_POLICY_OPTIONS,
        hint: "channels.feishuGroupPolicyHint",
      },
      groupAllowedGroupsField("channels.feishuAllowedGroupsHint"),
      groupAllowFromField("channels.feishuGroupAllowFromHint"),
      {
        id: "requireMention",
        label: "channels.feishuRequireMention",
        type: "select",
        required: false,
        defaultValue: "true",
        options: [
          { value: "true", label: "channels.requireMentionTrue" },
          { value: "false", label: "channels.requireMentionFalse" },
        ],
        hint: "channels.feishuRequireMentionHint",
      },
    ],
    commonFields: { enabled: true },
  },

  line: {
    fields: [
      {
        id: "channelAccessToken",
        label: "channels.lineChannelAccessToken",
        type: "password",
        required: true,
        placeholder: "channels.lineChannelAccessTokenPlaceholder",
        hint: "channels.lineChannelAccessTokenHint",
        isSecret: true,
      },
      {
        id: "channelSecret",
        label: "channels.lineChannelSecret",
        type: "password",
        required: true,
        placeholder: "channels.lineChannelSecretPlaceholder",
        hint: "channels.lineChannelSecretHint",
        isSecret: true,
      },
    ],
    commonFields: { enabled: true },
  },

  matrix: {
    fields: [
      {
        id: "homeserver",
        label: "channels.matrixHomeserver",
        type: "text",
        required: true,
        placeholder: "channels.matrixHomeserverPlaceholder",
        hint: "channels.matrixHomeserverHint",
      },
      {
        id: "userId",
        label: "channels.matrixUserId",
        type: "text",
        required: true,
        placeholder: "channels.matrixUserIdPlaceholder",
        hint: "channels.matrixUserIdHint",
      },
      {
        id: "password",
        label: "channels.matrixPassword",
        type: "password",
        required: true,
        placeholder: "channels.matrixPasswordPlaceholder",
        hint: "channels.matrixPasswordHint",
        isSecret: true,
      },
      {
        id: "encryption",
        label: "channels.matrixEncryption",
        type: "select",
        required: false,
        defaultValue: "true",
        options: [
          { value: "true", label: "channels.enabledLabel" },
          { value: "false", label: "channels.disabledLabel" },
        ],
        hint: "channels.matrixEncryptionHint",
      },
    ],
    commonFields: { enabled: true },
  },

  mattermost: {
    fields: [
      {
        id: "botToken",
        label: "channels.mattermostBotToken",
        type: "password",
        required: true,
        placeholder: "channels.mattermostBotTokenPlaceholder",
        hint: "channels.mattermostBotTokenHint",
        isSecret: true,
      },
      {
        id: "baseUrl",
        label: "channels.mattermostBaseUrl",
        type: "text",
        required: true,
        placeholder: "channels.mattermostBaseUrlPlaceholder",
        hint: "channels.mattermostBaseUrlHint",
      },
    ],
    commonFields: { enabled: true },
  },

  msteams: {
    fields: [
      {
        id: "appId",
        label: "channels.msteamsAppId",
        type: "text",
        required: true,
        placeholder: "channels.msteamsAppIdPlaceholder",
        hint: "channels.msteamsAppIdHint",
      },
      {
        id: "appPassword",
        label: "channels.msteamsAppPassword",
        type: "password",
        required: true,
        placeholder: "channels.msteamsAppPasswordPlaceholder",
        hint: "channels.msteamsAppPasswordHint",
        isSecret: true,
      },
      {
        id: "tenantId",
        label: "channels.msteamsTenantId",
        type: "text",
        required: false,
        placeholder: "channels.msteamsTenantIdPlaceholder",
        hint: "channels.msteamsTenantIdHint",
      },
      dmPolicyField(),
      groupPolicyField(),
      groupAllowedGroupsField("channels.msteamsAllowedGroupsHint"),
      groupAllowFromField("channels.msteamsGroupAllowFromHint"),
    ],
    commonFields: { enabled: true },
  },

  discord: {
    fields: [
      {
        id: "token",
        label: "channels.discordToken",
        type: "password",
        required: true,
        placeholder: "channels.discordTokenPlaceholder",
        hint: "channels.discordTokenHint",
        isSecret: true,
      },
      dmPolicyField(),
      groupPolicyField(),
      groupAllowedGroupsField("channels.discordAllowedGroupsHint"),
      groupAllowFromField("channels.discordGroupAllowFromHint"),
    ],
    commonFields: { enabled: true },
  },

  slack: {
    fields: [
      {
        id: "botToken",
        label: "channels.slackBotToken",
        type: "password",
        required: true,
        placeholder: "channels.slackBotTokenPlaceholder",
        hint: "channels.slackBotTokenHint",
        isSecret: true,
      },
      {
        id: "appToken",
        label: "channels.slackAppToken",
        type: "password",
        required: false,
        placeholder: "channels.slackAppTokenPlaceholder",
        hint: "channels.slackAppTokenHint",
        isSecret: true,
      },
      {
        id: "mode",
        label: "channels.slackMode",
        type: "select",
        required: false,
        defaultValue: "socket",
        options: [
          { value: "socket", label: "Socket Mode" },
          { value: "http", label: "HTTP Mode" },
        ],
        hint: "channels.slackModeHint",
      },
      dmPolicyField(),
      groupPolicyField(),
      groupAllowedGroupsField("channels.slackAllowedGroupsHint"),
      groupAllowFromField("channels.slackGroupAllowFromHint"),
    ],
    commonFields: { enabled: true },
  },

  googlechat: {
    fields: [
      {
        id: "serviceAccountFile",
        label: "channels.googlechatServiceAccountFile",
        type: "text",
        required: true,
        placeholder: "channels.googlechatServiceAccountFilePlaceholder",
        hint: "channels.googlechatServiceAccountFileHint",
      },
      {
        id: "webhookUrl",
        label: "channels.googlechatWebhookUrl",
        type: "text",
        required: false,
        placeholder: "channels.googlechatWebhookUrlPlaceholder",
        hint: "channels.googlechatWebhookUrlHint",
      },
      dmPolicyField(),
      groupPolicyField(),
      groupAllowedGroupsField("channels.googlechatAllowedGroupsHint"),
      groupAllowFromField("channels.googlechatGroupAllowFromHint"),
    ],
    commonFields: { enabled: true },
  },

  whatsapp: {
    fields: [
      {
        id: "dmPolicy",
        label: "channels.fieldDmPolicy",
        type: "select",
        required: false,
        defaultValue: "pairing",
        options: DM_POLICY_OPTIONS_NO_DISABLED,
        hint: "channels.whatsappSetupHint",
      },
    ],
    commonFields: { enabled: true },
  },

  signal: {
    fields: [
      {
        id: "account",
        label: "channels.signalAccount",
        type: "text",
        required: true,
        placeholder: "channels.signalAccountPlaceholder",
        hint: "channels.signalAccountHint",
      },
      {
        id: "httpUrl",
        label: "channels.signalHttpUrl",
        type: "text",
        required: false,
        placeholder: "channels.signalHttpUrlPlaceholder",
        hint: "channels.signalHttpUrlHint",
      },
      dmPolicyField(),
      groupPolicyField(),
      groupAllowedGroupsField("channels.signalAllowedGroupsHint"),
      groupAllowFromField("channels.signalGroupAllowFromHint"),
    ],
    commonFields: { enabled: true },
  },

  imessage: {
    fields: [
      {
        id: "service",
        label: "channels.imessageService",
        type: "select",
        required: false,
        defaultValue: "imessage",
        options: [
          { value: "imessage", label: "iMessage" },
          { value: "sms", label: "SMS" },
          { value: "auto", label: "Auto" },
        ],
        hint: "channels.imessageServiceHint",
      },
      dmPolicyField(),
      groupPolicyField(),
      groupAllowedGroupsField("channels.imessageAllowedGroupsHint"),
      groupAllowFromField("channels.imessageGroupAllowFromHint"),
    ],
    commonFields: { enabled: true },
  },
};
