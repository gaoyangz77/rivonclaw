import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import type { ScopeHolder } from "../lib/permission-scope.js";

const store = vi.hoisted(() => ({
  currentUser: { isOwner: true, permissionScopes: [] } as ScopeHolder,
}));
vi.mock("../store/RuntimeStatusProvider.js", () => ({
  useRuntimeStatus: () => ({ appSettings: { tutorialEnabled: true } }),
}));
vi.mock("../store/EntityStoreProvider.js", () => ({ useEntityStore: () => store }));

import { TutorialProvider, useTutorial } from "./TutorialProvider.js";

function Probe() {
  const tour = useTutorial();
  return (
    <>
      <button onClick={tour.start}>start</button>
      <button onClick={tour.next}>next</button>
      <output data-testid="state">
        {String(tour.isPlaying)}:{tour.currentStepIndex}:{tour.steps.length}
      </output>
    </>
  );
}

beforeEach(() => {
  store.currentUser = { isOwner: true, permissionScopes: [] };
});

describe("tutorial workspace lifetime", () => {
  it("stops and resets on same-route workspace switches", () => {
    const page = (tab: string) => (
      <TutorialProvider currentPath="/commerce/affiliate/analytics" activeTabId={tab}>
        <Probe />
      </TutorialProvider>
    );
    const view = render(page("one"));
    fireEvent.click(screen.getByText("start"));
    fireEvent.click(screen.getByText("next"));
    expect(screen.getByTestId("state").textContent).toBe("true:1:11");
    view.rerender(page("two"));
    expect(screen.getByTestId("state").textContent).toBe("false:0:11");
  });

  it("replaces supervisor steps and stops playback when the audience changes", () => {
    const page = (
      <TutorialProvider currentPath="/commerce/affiliate/analytics">
        <Probe />
      </TutorialProvider>
    );
    const view = render(page);
    fireEvent.click(screen.getByText("start"));
    store.currentUser = {
      isOwner: false,
      permissionScopes: [GQL.PermissionScope.AffiliateBusinessDeveloper],
    };
    view.rerender(
      <TutorialProvider currentPath="/commerce/affiliate/analytics">
        <Probe />
      </TutorialProvider>,
    );
    expect(screen.getByTestId("state").textContent).toBe("false:0:4");
    fireEvent.click(screen.getByText("start"));
    expect(screen.getByTestId("state").textContent).toBe("true:0:4");
  });
});
