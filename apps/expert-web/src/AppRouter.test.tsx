import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "./AppRouter.js";

vi.mock("./App.js", () => ({
  App: () => <div>Expert application</div>,
}));

afterEach(cleanup);

describe("AppRouter", () => {
  it.each(["/expert", "/expert/", "/expert/conversations/example"])(
    "renders Expert for %s",
    (path) => {
      render(
        <MemoryRouter initialEntries={[path]}>
          <AppRouter />
        </MemoryRouter>,
      );

      expect(screen.getByText("Expert application")).toBeTruthy();
    },
  );

  it("redirects unknown application paths to /expert", () => {
    render(
      <MemoryRouter initialEntries={["/unknown"]}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(screen.getByText("Expert application")).toBeTruthy();
  });
});
