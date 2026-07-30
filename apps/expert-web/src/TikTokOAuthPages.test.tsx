import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpertStore, expertStore } from "./store/expert-store.js";
import { ExpertStoreProvider } from "./store/context.js";
import { I18nProvider } from "./i18n.js";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  navigateBrowser: vi.fn(),
}));

vi.mock("./api/client.js", () => ({
  apolloClient: {
    mutate: mocks.mutate,
  },
}));

vi.mock("./browser-navigation.js", () => ({
  navigateBrowser: mocks.navigateBrowser,
}));

vi.mock("./AuthScreen.js", () => ({
  AuthScreen: ({
    initialMode,
    onAuthenticated,
  }: {
    initialMode?: string;
    onAuthenticated?: () => void;
  }) => (
    <button
      type="button"
      data-testid="claim-auth-screen"
      data-mode={initialMode}
      onClick={onAuthenticated}
    >
      Complete registration
    </button>
  ),
}));

import { TikTokOAuthCallbackPage } from "./TikTokOAuthCallbackPage.js";
import { TikTokOAuthStartPage } from "./TikTokOAuthStartPage.js";

beforeEach(() => {
  mocks.mutate.mockReset();
  mocks.navigateBrowser.mockReset();
  expertStore.signOut();
});

afterEach(cleanup);

describe("TikTok OAuth browser pages", () => {
  it("consumes the one-time start ticket, clears it from the URL, and navigates to TikTok", async () => {
    window.history.pushState({}, "", "/oauth/tiktok/start?ticket=secret-ticket");
    mocks.mutate.mockResolvedValue({
      data: {
        consumeTikTokOAuthBrowserStart: {
          authUrl: "https://services.tiktokshops.com/open/authorize?state=opaque",
        },
      },
    });

    render(<TikTokOAuthStartPage />);

    await waitFor(() =>
      expect(mocks.navigateBrowser).toHaveBeenCalledWith(
        "https://services.tiktokshops.com/open/authorize?state=opaque",
      ),
    );
    expect(window.location.search).toBe("");
    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { ticket: "secret-ticket" } }),
    );
  });

  it("completes Desktop OAuth, restores the web session, and renders every shop", async () => {
    window.history.pushState(
      {},
      "",
      "/oauth/tiktok/callback/service-1?code=tiktok-code&state=oauth-state",
    );
    mocks.mutate
      .mockResolvedValueOnce({
        data: {
          completeTikTokOAuth: {
            mode: "DESKTOP_OAUTH",
            webSessionEstablished: true,
            shops: [
              { shopId: "shop-1", shopName: "Alpha Shop" },
              { shopId: "shop-2", shopName: "Beta Shop" },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          webRefresh: {
            accessToken: "web-access",
            user: { email: "owner@example.com" },
          },
        },
      });
    const store = ExpertStore.create();

    render(
      <ExpertStoreProvider store={store}>
        <MemoryRouter initialEntries={["/oauth/tiktok/callback/service-1"]}>
          <Routes>
            <Route
              path="/oauth/tiktok/callback/:serviceId"
              element={<TikTokOAuthCallbackPage />}
            />
          </Routes>
        </MemoryRouter>
      </ExpertStoreProvider>,
    );

    expect(await screen.findByText("Your shop is connected")).toBeTruthy();
    expect(screen.getByText("Alpha Shop")).toBeTruthy();
    expect(screen.getByText("Beta Shop")).toBeTruthy();
    expect(store.authenticated).toBe(true);
    expect(store.userEmail).toBe("owner@example.com");
    expect(window.location.search).toBe("");
    expect(mocks.mutate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        variables: {
          code: "tiktok-code",
          state: "oauth-state",
          serviceId: "service-1",
        },
      }),
    );
  });

  it("shows a login fallback when the nonce cookie could not establish a web session", async () => {
    window.history.pushState(
      {},
      "",
      "/oauth/tiktok/callback/service-1?code=tiktok-code&state=oauth-state",
    );
    mocks.mutate.mockResolvedValue({
      data: {
        completeTikTokOAuth: {
          mode: "DESKTOP_OAUTH",
          webSessionEstablished: false,
          shops: [{ shopId: "shop-1", shopName: "Alpha Shop" }],
        },
      },
    });

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/oauth/tiktok/callback/service-1"]}>
          <Routes>
            <Route
              path="/oauth/tiktok/callback/:serviceId"
              element={<TikTokOAuthCallbackPage />}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(await screen.findByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByText("Alpha Shop")).toBeTruthy();
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });

  it("shows registration by default for a direct TikTok App Store authorization", async () => {
    window.history.pushState(
      {},
      "",
      "/oauth/tiktok/callback/service-1?code=direct-code",
    );
    mocks.mutate
      .mockResolvedValueOnce({
        data: {
          completeTikTokOAuth: {
            mode: "DIRECT_CLAIM",
            webSessionEstablished: false,
            claimStatus: "PENDING",
            shops: [{ shopId: "platform-shop-1", shopName: "Direct Shop" }],
          },
        },
      })
      .mockRejectedValueOnce(new Error("not logged in"))
      .mockResolvedValueOnce({
        data: {
          claimPendingTikTokShops: {
            status: "CLAIMED",
            shops: [{ shopId: "shop-1", shopName: "Direct Shop" }],
          },
        },
      });

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={["/oauth/tiktok/callback/service-1"]}>
          <Routes>
            <Route
              path="/oauth/tiktok/callback/:serviceId"
              element={<TikTokOAuthCallbackPage />}
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(await screen.findByText("Create your TK Copilot account")).toBeTruthy();
    expect(screen.getByText("Direct Shop")).toBeTruthy();
    const auth = screen.getByRole("button", { name: "Complete registration" });
    expect(auth.getAttribute("data-mode")).toBe("register");
    expect(window.location.search).toBe("");

    fireEvent.click(auth);
    expect(await screen.findByText("Your shop is connected")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download for macOS" })).toBeTruthy();
    expect(mocks.mutate).toHaveBeenCalledTimes(3);
  });

  it("automatically claims a direct authorization for an already logged-in browser", async () => {
    window.history.pushState(
      {},
      "",
      "/oauth/tiktok/callback/service-1?code=direct-code",
    );
    mocks.mutate
      .mockResolvedValueOnce({
        data: {
          completeTikTokOAuth: {
            mode: "DIRECT_CLAIM",
            webSessionEstablished: false,
            claimStatus: "PENDING",
            shops: [{ shopId: "platform-shop-1", shopName: "Direct Shop" }],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          webRefresh: {
            accessToken: "existing-web-access",
            user: { email: "browser-owner@example.com" },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          claimPendingTikTokShops: {
            status: "CLAIMED",
            shops: [{ shopId: "shop-1", shopName: "Direct Shop" }],
          },
        },
      });
    const store = ExpertStore.create();

    render(
      <ExpertStoreProvider store={store}>
        <MemoryRouter initialEntries={["/oauth/tiktok/callback/service-1"]}>
          <Routes>
            <Route
              path="/oauth/tiktok/callback/:serviceId"
              element={<TikTokOAuthCallbackPage />}
            />
          </Routes>
        </MemoryRouter>
      </ExpertStoreProvider>,
    );

    expect(await screen.findByText("Your shop is connected")).toBeTruthy();
    expect(screen.getByText(/browser-owner@example.com/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download for macOS" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download for Windows" })).toBeTruthy();
    expect(mocks.mutate).toHaveBeenCalledTimes(3);
  });

  it("does not offer account claiming after type=6 revoked the pending authorization", async () => {
    window.history.pushState(
      {},
      "",
      "/oauth/tiktok/callback/service-1?code=revoked-direct-code",
    );
    mocks.mutate.mockResolvedValue({
      data: {
        completeTikTokOAuth: {
          mode: "DIRECT_CLAIM",
          webSessionEstablished: false,
          claimStatus: "REVOKED",
          shops: [{ shopId: "platform-shop-1", shopName: "Revoked Shop" }],
        },
      },
    });

    render(
      <MemoryRouter initialEntries={["/oauth/tiktok/callback/service-1"]}>
        <Routes>
          <Route
            path="/oauth/tiktok/callback/:serviceId"
            element={<TikTokOAuthCallbackPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        "This TikTok Shop authorization was revoked before it could be claimed.",
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("claim-auth-screen")).toBeNull();
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });
});
