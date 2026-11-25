// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyModelSelector } from "./KeyModelSelector.js";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "zh" } }),
}));
afterEach(cleanup);

const keys = [
  { id: "cloud", provider: "rivonclaw-pro", label: "", model: "rivonclaw-flagship", isDefault: true },
  { id: "ds", provider: "deepseek", label: "", model: "deepseek-chat", isDefault: false },
];
const catalog = {
  // The backend serves the cloud plan's one model as "Flagship" (llmProxy.ts / plans.ts).
  "rivonclaw-pro": [{ id: "rivonclaw-flagship", name: "Flagship" }],
  deepseek: [{ id: "deepseek-chat", name: "DeepSeek Chat" }],
};

describe("KeyModelSelector model names", () => {
  it("shows the cloud plan's model under the localized name ProvidersPage uses", () => {
    render(
      <KeyModelSelector
        keys={keys}
        catalog={catalog}
        selectedProvider="rivonclaw-pro"
        selectedModel="rivonclaw-flagship"
        onChange={() => {}}
      />,
    );
    const trigger = screen.getByRole("button");
    expect(trigger.textContent).toContain("providers.cloudModelName");
    expect(trigger.textContent).not.toContain("Flagship");

    fireEvent.click(trigger);
    expect(document.body.textContent).toContain("providers.cloudModelName");
    expect(document.body.textContent).not.toContain("Flagship");
  });

  it("keeps the catalogue name for other providers", () => {
    render(
      <KeyModelSelector
        keys={keys}
        catalog={catalog}
        selectedProvider="deepseek"
        selectedModel="deepseek-chat"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button").textContent).toContain("DeepSeek Chat");
  });
});
