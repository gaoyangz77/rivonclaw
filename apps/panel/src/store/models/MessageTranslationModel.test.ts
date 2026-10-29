import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSnapshot } from "mobx-state-tree";
import { MessageTranslationModel } from "./MessageTranslationModel.js";
import { fetchJson } from "../../api/client.js";
vi.mock("../../api/client.js", () => ({ fetchJson: vi.fn() }));
const fetch = vi.mocked(fetchJson);
const input = {
  identity: "owner",
  key: "chat-1",
  text: "你好",
  samples: ["Hola"],
  signature: "one",
  fallbackLanguage: "en",
};
beforeEach(() => fetch.mockReset());
function store() {
  const model = MessageTranslationModel.create();
  model.setIdentity("owner");
  return model;
}
function body() {
  return JSON.parse(fetch.mock.calls.at(-1)![1]!.body as string);
}
describe("volatile language cache", () => {
  it("reuses detected language without history and does not persist cache", async () => {
    fetch.mockResolvedValue({ language: "es", source: "messages", text: "Hola" });
    const model = store();
    await model.translate(input);
    await model.translate({ ...input, samples: ["Other"], signature: "two" });
    expect(body().target).toEqual({ language: "es", source: "messages" });
    expect(body()).not.toHaveProperty("samples");
    expect(getSnapshot(model)).toEqual({});
    expect(MessageTranslationModel.create(getSnapshot(model)).languages.size).toBe(0);
  });
  it("reconsiders site fallback only after new evidence or a changed fallback", async () => {
    fetch.mockResolvedValue({ language: "en", source: "site", text: "Hello" });
    const model = store();
    await model.translate(input);
    await model.translate(input);
    expect(body().target.language).toBe("en");
    await model.translate({ ...input, signature: "new", samples: ["Hola otra vez"] });
    expect(body()).not.toHaveProperty("target");
    await model.translate({ ...input, fallbackLanguage: "es" });
    expect(body()).not.toHaveProperty("target");
  });
  it("isolates routes, clears on auth change, and rejects stale results", async () => {
    let finish!: (value: unknown) => void;
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const model = store();
    const pending = model.translate(input);
    model.setIdentity("member");
    finish({ language: "es", source: "messages", text: "Hola" });
    await expect(pending).rejects.toThrow("session changed");
    expect(model.languages.size).toBe(0);
    await expect(model.translate(input)).rejects.toThrow("session changed");
    model.setIdentity("owner");
    fetch.mockResolvedValue({ language: "es", source: "messages", text: "Hola" });
    await model.translate(input);
    await model.translate({ ...input, key: "chat-2" });
    expect(body()).not.toHaveProperty("target");
    model.setIdentity("");
    expect(model.languages.size).toBe(0);
  });
  it("does not cache cancelled or failed requests", async () => {
    fetch.mockRejectedValueOnce(new Error("Unavailable"));
    const model = store();
    await expect(model.translate(input)).rejects.toThrow("Unavailable");
    expect(model.languages.size).toBe(0);
    const controller = new AbortController();
    controller.abort();
    fetch.mockResolvedValue({ language: "es", source: "messages", text: "Hola" });
    await expect(model.translate({ ...input, signal: controller.signal })).rejects.toThrow();
    expect(model.languages.size).toBe(0);
  });
});
