// @vitest-environment jsdom

import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  TkButton,
  TkComposer,
  TkAlert,
  TkChoiceSelect,
  TkField,
  TkFormGroup,
  TkFormStack,
  TkEmptyState,
  TkLoadingState,
  TkIconButton,
  TkInteractiveTableRow,
  TkPageFrame,
  TkPageHeader,
  TkPanel,
  TkPanelBody,
  TkPanelFooter,
  TkPanelHeader,
  TkSection,
  TkSegmented,
  TkSwitch,
  TkSwitchControl,
  TkTableFrame,
  TkTabs,
  TkToolbar,
} from "./Primitives.js";

afterEach(cleanup);

describe("design-system primitives", () => {
  it("provides the shared page hierarchy without wrapping actions in another surface", () => {
    render(
      <TkPageFrame data-tutorial-id="campaign-page">
        <TkPageHeader
          eyebrow="Affiliate acquisition"
          title="Creator campaigns"
          description="Build a predictable outreach loop."
          actions={<button type="button">Refresh</button>}
        />
      </TkPageFrame>,
    );

    const page = document.querySelector("[data-tutorial-id='campaign-page']");
    expect(page?.classList.contains("tk-v1-page")).toBe(true);
    expect(screen.getByRole("heading", { level: 1, name: "Creator campaigns" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" }).parentElement?.className).toContain(
      "tk-v1-page-actions",
    );
  });

  it("provides reusable content, toolbar, and table layers", () => {
    render(
      <TkPanel as="section" padding="none" clip>
        <TkPanelHeader title="Campaigns" description="Current portfolio" actions="Add" />
        <TkPanelBody>Summary</TkPanelBody>
        <TkToolbar variant="open">Filters</TkToolbar>
        <TkTableFrame compact variant="embedded">
          <table>
            <tbody>
              <tr>
                <td>Campaign</td>
              </tr>
            </tbody>
          </table>
        </TkTableFrame>
        <TkPanelFooter align="end">12 campaigns</TkPanelFooter>
      </TkPanel>,
    );

    expect(document.querySelector(".tk-v1-panel-padding-none")).toBeTruthy();
    expect(document.querySelector("section.tk-v1-panel")).toBeTruthy();
    expect(document.querySelector(".tk-v1-panel-clip")).toBeTruthy();
    expect(document.querySelector(".tk-v1-panel-header")?.textContent).toContain("Campaigns");
    expect(document.querySelector(".tk-v1-panel-body")?.textContent).toContain("Summary");
    expect(document.querySelector(".tk-v1-toolbar-open")).toBeTruthy();
    expect(document.querySelector(".tk-v1-table-frame-embedded")).toBeTruthy();
    expect(document.querySelector(".tk-v1-table-compact")).toBeTruthy();
    expect(document.querySelector(".tk-v1-panel-footer")?.textContent).toContain("12 campaigns");
    expect(document.querySelector(".tk-v1-panel-footer-end")).toBeTruthy();
  });

  it("activates interactive table rows without hijacking nested controls", () => {
    const onActivate = vi.fn();
    const onNestedAction = vi.fn();
    render(
      <TkTableFrame>
        <table>
          <tbody>
            <TkInteractiveTableRow aria-label="Open Acme" onActivate={onActivate}>
              <td>Acme</td>
              <td>
                <input aria-label="Alias" />
                <button type="button" onClick={onNestedAction}>
                  Disconnect
                </button>
              </td>
            </TkInteractiveTableRow>
          </tbody>
        </table>
      </TkTableFrame>,
    );

    const row = screen.getByRole("row", { name: "Open Acme" });
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });
    expect(onActivate).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole("textbox", { name: "Alias" }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Alias" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(onNestedAction).toHaveBeenCalledOnce();
    expect(onActivate).toHaveBeenCalledTimes(3);
  });

  it("provides semantic form rhythm without page-owned spacing", () => {
    render(
      <TkFormStack gap="lg">
        <TkField label="Daily quota" />
        <TkFormGroup title="Follow-up checkpoints" description="Add up to three checkpoints.">
          <TkField label="Checkpoint 1" />
        </TkFormGroup>
      </TkFormStack>,
    );

    expect(document.querySelector(".tk-v1-form-stack-lg")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 4, name: "Follow-up checkpoints" })).toBeTruthy();
    expect(document.querySelector(".tk-v1-form-group-body")?.textContent).toContain("Checkpoint 1");
  });

  it("announces and locks a loading action", () => {
    render(<TkButton loading>Saving</TkButton>);

    const button = screen.getByRole("button", { name: "Saving" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect((button as HTMLButtonElement).type).toBe("button");
  });

  it("gives icon-only actions a stable accessible control contract", () => {
    render(
      <TkIconButton label="Refresh data">
        <span aria-hidden="true">R</span>
      </TkIconButton>,
    );

    const button = screen.getByRole("button", { name: "Refresh data" });
    expect(button.className).toContain("tk-v1-icon-button");
    expect((button as HTMLButtonElement).type).toBe("button");
    expect(button.getAttribute("title")).toBe("Refresh data");
  });

  it("submits the shared composer from its action and command-enter", () => {
    const onSubmit = vi.fn();
    const onValueChange = vi.fn();
    render(
      <TkComposer
        value="Ready to send"
        onValueChange={onValueChange}
        onSubmit={onSubmit}
        submitLabel="Send"
        placeholder="Write a reply"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Write a reply" });
    fireEvent.change(input, { target: { value: "Updated reply" } });
    expect(onValueChange).toHaveBeenCalledWith("Updated reply");
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("announces dangerous notices without relying on color", () => {
    render(
      <TkAlert tone="danger" title="Could not load">
        Check the connection and retry.
      </TkAlert>,
    );

    expect(screen.getByRole("alert").textContent).toContain("Could not load");
    expect(screen.getByRole("alert").textContent).toContain("Check the connection");
  });

  it("associates validation copy with the field", () => {
    render(<TkField label="Daily quota" error="Quota is too high." />);

    const input = screen.getByRole("textbox", { name: "Daily quota" });
    const description = document.getElementById(input.getAttribute("aria-describedby") ?? "");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(description?.textContent).toBe("Quota is too high.");
  });

  it("supports roving keyboard navigation for tabs", () => {
    function Harness() {
      const [value, setValue] = useState("attention");
      return (
        <TkTabs
          label="Work status"
          items={[
            { id: "attention", label: "Needs attention" },
            { id: "running", label: "Running" },
            { id: "complete", label: "Complete" },
          ]}
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<Harness />);
    const attention = screen.getByRole("tab", { name: "Needs attention" });
    attention.focus();
    fireEvent.keyDown(attention, { key: "ArrowRight" });

    const running = screen.getByRole("tab", { name: "Running" });
    expect(running.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(running);
  });

  it("supports rich page-navigation rails without page-local tab markup", () => {
    render(
      <TkTabs
        variant="rail"
        scrollable
        label="Team views"
        idPrefix="team-tab"
        items={[
          { id: "team", label: "Team", description: "3 operators", icon: "T" },
          { id: "safety", label: "Safety", description: "Ready", tone: "success" },
        ]}
        value="team"
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole("tablist", { name: "Team views" }).className).toContain(
      "tk-v1-tabs-rail",
    );
    expect(screen.getByRole("tablist", { name: "Team views" }).className).toContain(
      "tk-v1-tabs-scrollable",
    );
    expect(screen.getByRole("tab", { name: /Team/ }).id).toBe("team-tab-team");
    expect(screen.getByRole("tab", { name: /Safety/ }).className).toContain("tk-v1-tab-success");
  });

  it("uses radio semantics and keyboard navigation for segmented view controls", () => {
    function Harness() {
      const [value, setValue] = useState("all");
      return (
        <TkSegmented
          label="Account filter"
          items={[
            { id: "all", label: "All" },
            { id: "attention", label: "Needs attention" },
          ]}
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<Harness />);
    const all = screen.getByRole("radio", { name: "All" });
    all.focus();
    fireEvent.keyDown(all, { key: "ArrowRight" });

    const attention = screen.getByRole("radio", { name: "Needs attention" });
    expect(attention.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(attention);
  });

  it("reports switch changes through its controlled API", () => {
    const onChange = vi.fn();
    render(<TkSwitch label="Show agent activity" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Show agent activity" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("locks disabled switches without losing their accessible label", () => {
    render(
      <TkSwitch
        label="Privacy mode"
        description="Hide sensitive values."
        checked={false}
        onChange={() => {}}
        disabled
      />,
    );

    const input = screen.getByRole("checkbox", { name: /Privacy mode/ });
    expect((input as HTMLInputElement).disabled).toBe(true);
  });

  it("provides a compact shared switch for composite rows", () => {
    const onChange = vi.fn();
    render(
      <TkSwitchControl
        label="Enable campaign"
        checked={false}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Enable campaign" }));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(document.querySelector(".tk-v1-switch-control")).toBeTruthy();
  });

  it("associates choice-select guidance with its trigger", () => {
    render(
      <TkChoiceSelect
        label="Browser mode"
        value="standalone"
        onChange={() => {}}
        options={[{ value: "standalone", label: "Standalone" }]}
        hint="Controls browser access."
      />,
    );

    const trigger = screen.getByRole("button", { name: "Browser mode" });
    const hint = document.getElementById(trigger.getAttribute("aria-describedby") ?? "");
    expect(hint?.textContent).toBe("Controls browser access.");
  });

  it("forwards searchable choice-select behavior", () => {
    render(
      <TkChoiceSelect
        label="Business developer"
        value=""
        onChange={() => {}}
        options={[{ value: "alex", label: "Alex Morgan" }]}
        searchable
        searchPlaceholder="Find a business developer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Business developer" }));
    expect(screen.getByRole("textbox", { name: "Find a business developer" })).toBeTruthy();
  });

  it("allows pages to preserve heading hierarchy and tutorial hooks", () => {
    render(
      <TkSection title="Chat settings" headingLevel={2} data-tutorial-id="settings-chat">
        Content
      </TkSection>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Chat settings" })).toBeTruthy();
    expect(document.querySelector("[data-tutorial-id='settings-chat']")).toBeTruthy();
  });

  it("provides consistent empty and loading states", () => {
    render(
      <>
        <TkEmptyState title="Nothing here yet" />
        <TkLoadingState label="Loading records" size="inline" />
      </>,
    );

    expect(screen.getByRole("heading", { name: "Nothing here yet" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Loading records");
    expect(screen.getByRole("status").className).toContain("tk-v1-loading-state-inline");
  });
});
