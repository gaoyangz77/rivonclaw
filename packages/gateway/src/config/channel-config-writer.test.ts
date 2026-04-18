import { describe, it, expect } from "vitest";
import { migrateSingleAccountChannels } from "./channel-config-writer.js";

describe("migrateSingleAccountChannels", () => {
  it("returns empty array when no channels exist", () => {
    const config: Record<string, unknown> = {};
    const migrated = migrateSingleAccountChannels(config);
    expect(migrated).toEqual([]);
  });

  it("returns empty array when channels is not an object", () => {
    const config: Record<string, unknown> = { channels: "invalid" };
    const migrated = migrateSingleAccountChannels(config);
    expect(migrated).toEqual([]);
  });

  it("migrates telegram top-level botToken into accounts.default", () => {
    const config: Record<string, unknown> = {
      channels: {
        telegram: {
          enabled: true,
          botToken: "123:ABC",
          dmPolicy: "allowlist",
          allowFrom: ["456"],
        },
      },
    };

    const migrated = migrateSingleAccountChannels(config);

    expect(migrated).toEqual(["telegram"]);
    const telegram = (config.channels as Record<string, unknown>).telegram as Record<string, unknown>;
    expect(telegram.enabled).toBe(true);
    expect(telegram.botToken).toBeUndefined();
    expect(telegram.dmPolicy).toBeUndefined();
    expect(telegram.allowFrom).toBeUndefined();
    const accounts = telegram.accounts as Record<string, unknown>;
    const defaultAccount = accounts.default as Record<string, unknown>;
    expect(defaultAccount.botToken).toBe("123:ABC");
    expect(defaultAccount.dmPolicy).toBe("allowlist");
    expect(defaultAccount.allowFrom).toEqual(["456"]);
  });

  it("migrates when accounts exist but no default account", () => {
    const config: Record<string, unknown> = {
      channels: {
        telegram: {
          enabled: true,
          botToken: "legacy-token",
          streaming: "partial",
          accounts: {
            alerts: {
              enabled: true,
              botToken: "alerts-token",
            },
          },
        },
      },
    };

    const migrated = migrateSingleAccountChannels(config);

    expect(migrated).toEqual(["telegram"]);
    const telegram = (config.channels as Record<string, unknown>).telegram as Record<string, unknown>;
    expect(telegram.botToken).toBeUndefined();
    expect(telegram.streaming).toBeUndefined();
    const accounts = telegram.accounts as Record<string, unknown>;
    expect(accounts.alerts).toBeDefined();
    const defaultAccount = accounts.default as Record<string, unknown>;
    expect(defaultAccount.botToken).toBe("legacy-token");
    expect(defaultAccount.streaming).toBe("partial");
  });

  it("does not migrate when default account already exists", () => {
    const config: Record<string, unknown> = {
      channels: {
        telegram: {
          enabled: true,
          botToken: "top-level-token",
          accounts: {
            default: {
              botToken: "existing-default-token",
            },
          },
        },
      },
    };

    const migrated = migrateSingleAccountChannels(config);

    expect(migrated).toEqual([]);
    const telegram = (config.channels as Record<string, unknown>).telegram as Record<string, unknown>;
    // Top-level keys are preserved since default already exists
    expect(telegram.botToken).toBe("top-level-token");
    const accounts = telegram.accounts as Record<string, unknown>;
    const defaultAccount = accounts.default as Record<string, unknown>;
    expect(defaultAccount.botToken).toBe("existing-default-token");
  });

  it("preserves enabled flag at channel top level", () => {
    const config: Record<string, unknown> = {
      channels: {
        telegram: {
          enabled: true,
          botToken: "123:ABC",
        },
      },
    };

    migrateSingleAccountChannels(config);

    const telegram = (config.channels as Record<string, unknown>).telegram as Record<string, unknown>;
    expect(telegram.enabled).toBe(true);
    expect(telegram.botToken).toBeUndefined();
  });

  it("does not move keys that are not in the migration set", () => {
    const config: Record<string, unknown> = {
      channels: {
        telegram: {
          enabled: true,
          botToken: "123:ABC",
          customUnknownKey: "should-stay",
        },
      },
    };

    migrateSingleAccountChannels(config);

    const telegram = (config.channels as Record<string, unknown>).telegram as Record<string, unknown>;
    expect(telegram.customUnknownKey).toBe("should-stay");
    const accounts = telegram.accounts as Record<string, unknown>;
    const defaultAccount = accounts.default as Record<string, unknown>;
    expect(defaultAccount.botToken).toBe("123:ABC");
    expect(defaultAccount.customUnknownKey).toBeUndefined();
  });

  it("works for non-telegram channels (e.g. slack with token)", () => {
    const config: Record<string, unknown> = {
      channels: {
        slack: {
          enabled: true,
          token: "xoxb-slack-token",
          appToken: "xapp-slack-app",
          dmPolicy: "open",
        },
      },
    };

    const migrated = migrateSingleAccountChannels(config);

    expect(migrated).toEqual(["slack"]);
    const slack = (config.channels as Record<string, unknown>).slack as Record<string, unknown>;
    expect(slack.token).toBeUndefined();
    expect(slack.appToken).toBeUndefined();
    expect(slack.dmPolicy).toBeUndefined();
    const accounts = slack.accounts as Record<string, unknown>;
    const defaultAccount = accounts.default as Record<string, unknown>;
    expect(defaultAccount.token).toBe("xoxb-slack-token");
    expect(defaultAccount.appToken).toBe("xapp-slack-app");
    expect(defaultAccount.dmPolicy).toBe("open");
  });

  it("migrates multiple channels in a single pass", () => {
    const config: Record<string, unknown> = {
      channels: {
        telegram: {
          botToken: "tg-token",
        },
        slack: {
          token: "slack-token",
        },
      },
    };

    const migrated = migrateSingleAccountChannels(config);

    expect(migrated).toContain("telegram");
    expect(migrated).toContain("slack");
    expect(migrated).toHaveLength(2);
  });

  it("deep-clones object values during migration", () => {
    const allowFrom = ["123", "456"];
    const config: Record<string, unknown> = {
      channels: {
        telegram: {
          botToken: "tok",
          allowFrom,
        },
      },
    };

    migrateSingleAccountChannels(config);

    const telegram = (config.channels as Record<string, unknown>).telegram as Record<string, unknown>;
    const accounts = telegram.accounts as Record<string, unknown>;
    const defaultAccount = accounts.default as Record<string, unknown>;
    // Should be a separate array, not the same reference
    expect(defaultAccount.allowFrom).toEqual(["123", "456"]);
    expect(defaultAccount.allowFrom).not.toBe(allowFrom);
  });

  it("skips channels with no movable keys", () => {
    const config: Record<string, unknown> = {
      channels: {
        telegram: {
          enabled: true,
          accounts: {
            alerts: { botToken: "tok" },
          },
        },
      },
    };

    const migrated = migrateSingleAccountChannels(config);
    expect(migrated).toEqual([]);
  });

  it("handles telegram-specific streaming key migration", () => {
    const config: Record<string, unknown> = {
      channels: {
        telegram: {
          botToken: "tok",
          streaming: "partial",
        },
      },
    };

    migrateSingleAccountChannels(config);

    const telegram = (config.channels as Record<string, unknown>).telegram as Record<string, unknown>;
    const accounts = telegram.accounts as Record<string, unknown>;
    const defaultAccount = accounts.default as Record<string, unknown>;
    expect(defaultAccount.streaming).toBe("partial");
    expect(telegram.streaming).toBeUndefined();
  });

  it("does not move streaming for non-telegram channels", () => {
    const config: Record<string, unknown> = {
      channels: {
        slack: {
          token: "tok",
          streaming: "partial",
        },
      },
    };

    migrateSingleAccountChannels(config);

    const slack = (config.channels as Record<string, unknown>).slack as Record<string, unknown>;
    // streaming stays at top level for slack (not in COMMON set, not in slack per-channel set)
    expect(slack.streaming).toBe("partial");
    const accounts = slack.accounts as Record<string, unknown>;
    const defaultAccount = accounts.default as Record<string, unknown>;
    expect(defaultAccount.streaming).toBeUndefined();
  });
});
