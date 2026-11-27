import { flow, getEnv, types } from "mobx-state-tree";
import { observable } from "mobx";
import { CS_TRANSLATE_REPLY_MUTATION } from "../../api/shops-queries.js";
import type { MessageLanguageSource, MessageTranslationResult } from "../../lib/message-translation.js";
import type { PanelStoreEnv } from "../types.js";

interface CachedLanguage {
  language: string;
  source: MessageLanguageSource;
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
      const response = yield getEnv<PanelStoreEnv>(self).apolloClient.mutate({
        mutation: CS_TRANSLATE_REPLY_MUTATION,
        context: { fetchOptions: { signal: input.signal } },
        variables: {
          input: {
            text: input.text,
            fallbackLanguage: input.fallbackLanguage,
            ...(target
              ? { target: { language: target.language, source: target.source.toUpperCase() } }
              : { samples: input.samples }),
          },
        },
      });
      const translation = response.data?.translateCsReply as
        | { language: string; source: string; text: string }
        | undefined;
      if (!translation) throw new Error("Translation returned no result");
      const result: MessageTranslationResult = {
        language: translation.language,
        source: translation.source.toLowerCase() as MessageLanguageSource,
        text: translation.text,
      };
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
