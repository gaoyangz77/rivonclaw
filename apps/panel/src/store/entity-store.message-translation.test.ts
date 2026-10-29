import { afterEach, describe, expect, it } from "vitest";
import { runInAction } from "mobx";
import { applyPatch } from "mobx-state-tree";
import { entityStore } from "./entity-store.js";
const user = (userId: string) => ({
  userId,
  accountId: "owner",
  email: `${userId}@example.com`,
  createdAt: "2026-10-29T00:00:00Z",
});
afterEach(() => applyPatch(entityStore, { op: "replace", path: "/currentUser", value: null }));
describe("translation authentication boundary", () => {
  it("updates volatile identity and clears cached decisions on real root-store owner/member/logout changes", () => {
    applyPatch(entityStore, { op: "replace", path: "/currentUser", value: user("owner") });
    expect(entityStore.messageTranslation.identity).toBe(JSON.stringify(["owner", "owner"]));
    // Observable volatile memory is deliberately absent from the root snapshots.
    runInAction(() =>
      entityStore.messageTranslation.languages.set("chat", {
        language: "es",
        source: "messages",
        signature: "one",
        fallbackLanguage: "en",
      }),
    );
    applyPatch(entityStore, { op: "replace", path: "/currentUser", value: user("member") });
    expect(entityStore.messageTranslation.identity).toBe(JSON.stringify(["owner", "member"]));
    expect(entityStore.messageTranslation.languages.size).toBe(0);
    runInAction(() =>
      entityStore.messageTranslation.languages.set("chat", {
        language: "es",
        source: "messages",
        signature: "one",
        fallbackLanguage: "en",
      }),
    );
    entityStore.clearAuth();
    expect(entityStore.messageTranslation.identity).toBe("");
    expect(entityStore.messageTranslation.languages.size).toBe(0);
  });
});
