import { flow, types } from "mobx-state-tree";
import { observable } from "mobx";
import { API, clientPath, type MessageTranslationResult } from "@rivonclaw/core/api-contract";
import { fetchJson } from "../../api/client.js";

interface CachedLanguage {
  language: string;
  source: "messages" | "site";
  signature: string;
  fallbackLanguage: string;
}
export const MessageTranslationModel = types
  .model("MessageTranslation")
  .volatile(() => ({
    // Volatile: no snapshots, persistence, or Desktop SSE replication.
    languages: observable.map<string, CachedLanguage>(),
    identity: "",
    revision: 0,
  }))
  .actions((self) => ({
    setIdentity(identity: string) {
      if (identity === self.identity) return;
      self.identity = identity;
      self.revision++;
      self.languages.clear();
    },
    translate: flow(function* (input: {
      identity: string;
      key: string;
      text: string;
      samples: string[];
      signature: string;
      fallbackLanguage: string;
      signal?: AbortSignal;
    }) {
      if (!input.identity || input.identity !== self.identity)
        throw new Error("Translation session changed");
      const revision = self.revision;
      const cached = self.languages.get(input.key);
      const target =
        cached &&
        (cached.source === "messages" ||
          (cached.signature === input.signature &&
            cached.fallbackLanguage === input.fallbackLanguage))
          ? { language: cached.language, source: cached.source }
          : undefined;
      const result: MessageTranslationResult = yield fetchJson(
        clientPath(API["messaging.translate"]),
        {
          method: "POST",
          signal: input.signal,
          body: JSON.stringify({
            text: input.text,
            fallbackLanguage: input.fallbackLanguage,
            ...(target ? { target } : { samples: input.samples }),
          }),
        },
      );
      if (input.signal?.aborted || self.revision !== revision || self.identity !== input.identity)
        throw new Error("Translation session changed");
      self.languages.set(input.key, {
        language: result.language,
        source: result.source,
        signature: input.signature,
        fallbackLanguage: input.fallbackLanguage,
      });
      return result;
    }),
  }));
