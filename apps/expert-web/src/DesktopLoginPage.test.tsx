import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopLoginPage } from "./DesktopLoginPage.js";
import { ExpertStoreProvider } from "./store/context.js";
import { ExpertStore } from "./store/expert-store.js";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  query: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock("./api/client.js", () => ({
  apolloClient: {
    mutate: mocks.mutate,
    query: mocks.query,
  },
}));

vi.mock("./api/auth-session.js", () => ({
  setAccessToken: mocks.setAccessToken,
}));

vi.mock("./AuthScreen.js", () => ({
  AuthScreen: ({
    onAuthenticated,
  }: {
    onAuthenticated?: (payload: {
      accessToken: string;
      user: { email: string };
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onAuthenticated?.({
          accessToken: "web-access",
          user: { email: "owner@example.com" },
        })
      }
    >
      Complete browser login
    </button>
  ),
}));

beforeEach(() => {
  window.history.pushState({}, "", "/account/desktop-login?ticket=browser-ticket");
  mocks.query.mockReset().mockResolvedValue({
    data: {
      browserToDesktopLoginAttempt: {
        status: "PENDING",
        deviceName: "Test Mac",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
  });
  mocks.mutate.mockReset().mockRejectedValue(new Error("No browser session"));
  mocks.setAccessToken.mockReset();
});

afterEach(cleanup);

describe("DesktopLoginPage", () => {
  it("shows the approval screen immediately after browser authentication", async () => {
    const store = ExpertStore.create();

    render(
      <ExpertStoreProvider store={store}>
        <DesktopLoginPage />
      </ExpertStoreProvider>,
    );

    const authenticate = await screen.findByRole("button", {
      name: "Complete browser login",
    });
    fireEvent.click(authenticate);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Continue on this desktop?" })).toBeTruthy(),
    );
    expect(screen.getByText("Test Mac")).toBeTruthy();
    expect(screen.getByText("owner@example.com")).toBeTruthy();
    expect(store.authenticated).toBe(true);
  });
});
