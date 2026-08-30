// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentSettingsSection } from "./components/AgentSettingsSection.js";
import { AppSettingsSection } from "./components/AppSettingsSection.js";
import { ChatSettingsSection } from "./components/ChatSettingsSection.js";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe("Settings design-system pilot", () => {
  it("keeps browser-mode selection behavior behind the shared choice select", () => {
    const onChange = vi.fn();
    render(
      <AgentSettingsSection
        saving={false}
        settingsReady
        browserMode="standalone"
        handleBrowserModeChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "settings.browser.mode" }));
    fireEvent.click(screen.getByRole("button", { name: /settings.browser.modeCdp/ }));
    expect(onChange).toHaveBeenCalledWith("cdp");
  });

  it("exposes accent choices as one accessible radio group", () => {
    const onAccentChange = vi.fn();
    render(
      <AppSettingsSection
        accentColor="blue"
        privacyMode={false}
        saving={false}
        settingsReady
        handleAccentColorChange={onAccentChange}
        handleTogglePrivacyMode={() => {}}
      />,
    );

    expect(
      screen.getByRole("radio", { name: "settings.app.accentBlue" }).getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "settings.app.accentOrange" }));
    expect(onAccentChange).toHaveBeenCalledWith("orange");
  });

  it("preserves chat toggle callbacks through shared switches", () => {
    const onShowAgentEvents = vi.fn();
    render(
      <ChatSettingsSection
        showAgentEvents={false}
        preserveToolEvents={false}
        collapseMessages={false}
        saving={false}
        settingsReady
        handleToggleShowAgentEvents={onShowAgentEvents}
        handleTogglePreserveToolEvents={() => {}}
        handleToggleCollapseMessages={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /settings.chat.showAgentEvents/ }));
    expect(onShowAgentEvents).toHaveBeenCalledWith(true);
  });
});
