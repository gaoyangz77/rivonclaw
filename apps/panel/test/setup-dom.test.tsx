import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

/**
 * Guards the `afterEach(cleanup)` registration in `test/setup-dom.ts`.
 *
 * React Testing Library only self-registers that hook when the runner installs
 * globals, and this project runs with `globals: false`. When the registration
 * is missing nothing is ever unmounted, so no `useEffect` cleanup runs and the
 * suite leaks timers, rAF callbacks and `window` listeners into Vitest's jsdom
 * teardown - which surfaced as an intermittent `ReferenceError: window is not
 * defined` that failed the run while every test passed.
 *
 * These two tests are ordered on purpose: the first mounts a tree, the second
 * asserts it is gone. If the hook is ever dropped, the second one fails.
 */
describe("test environment", () => {
  it("mounts a tree", () => {
    render(<div data-testid="cleanup-sentinel">mounted</div>);
    expect(document.querySelectorAll("[data-testid=cleanup-sentinel]")).toHaveLength(1);
  });

  it("unmounts what the previous test rendered", () => {
    expect(document.querySelectorAll("[data-testid=cleanup-sentinel]")).toHaveLength(0);
    expect(document.body.children).toHaveLength(0);
  });
});
