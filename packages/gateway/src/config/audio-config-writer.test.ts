import { describe, it, expect } from "vitest";
import { generateAudioConfig, mergeAudioConfig } from "./audio-config-writer.js";

describe("audio-config-writer", () => {
  describe("generateAudioConfig", () => {
    it("returns null when STT is disabled", () => {
      const config = generateAudioConfig(false, "groq");
      expect(config).toBeNull();
    });

    it("generates Groq config when enabled", () => {
      const config = generateAudioConfig(true, "groq");
      expect(config).toEqual({
        models: [
          {
            provider: "groq",
            model: "whisper-large-v3-turbo",
            type: "provider",
            capabilities: ["audio"],
          },
        ],
        audio: {
          enabled: true,
          maxBytes: 25 * 1024 * 1024,
          timeoutSeconds: 300,
          scope: {
            default: "allow",
          },
        },
      });
    });

    it("generates Volcengine CLI config when enabled with paths", () => {
      const config = generateAudioConfig(true, "volcengine", {
        nodeBin: "/usr/local/bin/node",
        sttCliPath: "/path/to/volcengine-stt-cli.mjs",
      });
      expect(config).toEqual({
        models: [
          {
            type: "cli",
            command: "/usr/local/bin/node",
            args: ["/path/to/volcengine-stt-cli.mjs", "{{MediaPath}}"],
            capabilities: ["audio"],
          },
        ],
        audio: {
          enabled: true,
          maxBytes: 25 * 1024 * 1024,
          timeoutSeconds: 300,
          scope: {
            default: "allow",
          },
        },
      });
    });

    it("returns null for Volcengine when nodeBin/sttCliPath not provided", () => {
      const config = generateAudioConfig(true, "volcengine");
      expect(config).toBeNull();
    });
  });

  describe("mergeAudioConfig", () => {
    it("removes audio config when audioConfig is null", () => {
      const config = {
        tools: {
          media: {
            audio: { enabled: true },
            video: { enabled: false },
          },
        },
      };

      const result = mergeAudioConfig(config, null);
      expect(result.tools).toEqual({
        media: {
          video: { enabled: false },
        },
      });
    });

    it("adds audio config to empty config", () => {
      const config = {};
      const audioConfig = {
        audio: { enabled: true },
        models: [
          {
            provider: "openai",
            model: "whisper-1",
            type: "provider" as const,
            capabilities: ["audio"] as ["audio"],
          },
        ],
      };

      const result = mergeAudioConfig(config, audioConfig);
      expect(result).toEqual({
        tools: {
          media: {
            audio: audioConfig.audio,
            models: audioConfig.models,
          },
        },
      });
    });

    it("merges audio config with existing tools.media", () => {
      const config = {
        tools: {
          media: {
            image: { enabled: true },
          },
        },
      };
      const audioConfig = {
        audio: { enabled: true },
        models: [
          {
            provider: "openai",
            type: "provider" as const,
            capabilities: ["audio"] as ["audio"],
          },
        ],
      };

      const result = mergeAudioConfig(config, audioConfig);
      expect(result).toEqual({
        tools: {
          media: {
            image: { enabled: true },
            audio: audioConfig.audio,
            models: audioConfig.models,
          },
        },
      });
    });

    it("overwrites existing audio config", () => {
      const config = {
        tools: {
          media: {
            audio: { enabled: false, models: [] },
          },
        },
      };
      const newAudioConfig = {
        audio: { enabled: true },
        models: [
          {
            provider: "volcengine",
            type: "provider" as const,
            capabilities: ["audio"] as ["audio"],
          },
        ],
      };

      const result = mergeAudioConfig(config, newAudioConfig);
      expect(result.tools).toEqual({
        media: {
          audio: newAudioConfig.audio,
          models: newAudioConfig.models,
        },
      });
    });

    it("moves legacy nested models and preserves non-audio media models", () => {
      const config = {
        tools: {
          media: {
            models: [{ provider: "openai", model: "gpt-4o", capabilities: ["image"] }],
            audio: {
              enabled: true,
              models: [
                {
                  provider: "custom-stt",
                  model: "speech-1",
                  type: "provider",
                  capabilities: ["audio"],
                },
              ],
            },
            video: { enabled: true },
          },
        },
      };

      const result = mergeAudioConfig(config, generateAudioConfig(true, "groq"));
      expect(result.tools).toEqual({
        media: {
          audio: {
            enabled: true,
            maxBytes: 25 * 1024 * 1024,
            timeoutSeconds: 300,
            scope: { default: "allow" },
          },
          models: [
            { provider: "openai", model: "gpt-4o", capabilities: ["image"] },
            {
              provider: "custom-stt",
              model: "speech-1",
              type: "provider",
              capabilities: ["audio"],
            },
            {
              provider: "groq",
              model: "whisper-large-v3-turbo",
              type: "provider",
              capabilities: ["audio"],
            },
          ],
          video: { enabled: true },
        },
      });
    });
  });
});
