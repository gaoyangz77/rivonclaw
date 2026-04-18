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
        enabled: true,
        models: [
          {
            provider: "groq",
            model: "whisper-large-v3-turbo",
            type: "provider",
            capabilities: ["audio"],
          },
        ],
        maxBytes: 25 * 1024 * 1024,
        timeoutSeconds: 300,
        scope: {
          default: "allow",
        },
      });
    });

    it("generates Volcengine CLI config when enabled with paths", () => {
      const config = generateAudioConfig(true, "volcengine", {
        nodeBin: "/usr/local/bin/node",
        sttCliPath: "/path/to/volcengine-stt-cli.mjs",
      });
      expect(config).toEqual({
        enabled: true,
        models: [
          {
            type: "cli",
            command: "/usr/local/bin/node",
            args: ["/path/to/volcengine-stt-cli.mjs", "{{MediaPath}}"],
          },
        ],
        maxBytes: 25 * 1024 * 1024,
        timeoutSeconds: 300,
        scope: {
          default: "allow",
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
        enabled: true,
        models: [{ provider: "openai", model: "whisper-1" }],
      };

      const result = mergeAudioConfig(config, audioConfig);
      expect(result).toEqual({
        tools: {
          media: {
            audio: audioConfig,
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
        enabled: true,
        models: [{ provider: "openai" }],
      };

      const result = mergeAudioConfig(config, audioConfig);
      expect(result).toEqual({
        tools: {
          media: {
            image: { enabled: true },
            audio: audioConfig,
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
        enabled: true,
        models: [{ provider: "volcengine" }],
      };

      const result = mergeAudioConfig(config, newAudioConfig);
      expect(result.tools).toEqual({
        media: {
          audio: newAudioConfig,
        },
      });
    });
  });
});
