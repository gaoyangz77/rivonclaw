import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthScreen } from "./AuthScreen.js";
import { apolloClient } from "./api/client.js";
import { getAccessToken, setAccessToken } from "./api/auth-session.js";
import {
  REQUEST_CAPTCHA,
  WEB_GOOGLE_LOGIN,
  WEB_LOGIN,
  WEB_REGISTER,
} from "./api/operations.js";
import { I18nProvider } from "./i18n.js";
import { ExpertStore } from "./store/expert-store.js";
import { ExpertStoreProvider } from "./store/context.js";

const googleConfig = { enabled: true, clientId: "web-client-id" };
let googleCallback: ((response: { credential?: string }) => void) | undefined;

function renderAuth(language = "en") {
  window.history.replaceState({}, "", language === "en" ? "/" : `/?lang=${language}`);
  const store = ExpertStore.create();
  render(
    <I18nProvider>
      <ExpertStoreProvider store={store}>
        <AuthScreen googleConfig={googleConfig} />
      </ExpertStoreProvider>
    </I18nProvider>,
  );
  return store;
}

function installGoogleButton() {
  const initialize = vi.fn(
    (options: { callback: (response: { credential?: string }) => void }) => {
      googleCallback = options.callback;
    },
  );
  const renderButton = vi.fn((parent: HTMLElement) => {
    const button = document.createElement("button");
    button.textContent = "Continue with Google";
    button.addEventListener("click", () => googleCallback?.({ credential: "google-id-token" }));
    parent.append(button);
  });
  window.google = { accounts: { id: { initialize, renderButton } } };
  return { initialize, renderButton };
}

function captchaResult(token = "captcha-token") {
  return { data: { requestCaptcha: { token, svg: "<svg></svg>" } } };
}

function googleResult() {
  return {
    data: {
      webGoogleLogin: {
        accessToken: "tk-access-token",
        user: { email: "operator@example.com" },
      },
    },
  };
}

describe("AuthScreen Google sign-in", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
    localStorage.clear();
    googleCallback = undefined;
    installGoogleButton();
  });

  afterEach(cleanup);

  it("initializes GIS and signs into the existing in-memory TK Copilot session", async () => {
    const mutate = vi.spyOn(apolloClient, "mutate").mockImplementation(async (options) => {
      if (options.mutation === REQUEST_CAPTCHA) return captchaResult() as never;
      if (options.mutation === WEB_GOOGLE_LOGIN) return googleResult() as never;
      throw new Error("Unexpected mutation");
    });
    const store = renderAuth();

    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));

    await waitFor(() => expect(store.authenticated).toBe(true));
    expect(store.userEmail).toBe("operator@example.com");
    expect(getAccessToken()).toBe("tk-access-token");
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { input: { idToken: "google-id-token" } } }),
    );
  });

  it("enters password verification and sends password plus captcha when linking", async () => {
    let googleAttempts = 0;
    const mutate = vi.spyOn(apolloClient, "mutate").mockImplementation(async (options) => {
      if (options.mutation === REQUEST_CAPTCHA) return captchaResult() as never;
      if (options.mutation === WEB_GOOGLE_LOGIN) {
        googleAttempts += 1;
        if (googleAttempts === 1) {
          throw {
            errors: [{ extensions: { code: "GOOGLE_ACCOUNT_LINK_REQUIRED" } }],
          };
        }
        return googleResult() as never;
      }
      throw new Error("Unexpected mutation");
    });
    const store = renderAuth();
    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));

    expect(await screen.findByText("This email already has a TK Copilot account")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.change(screen.getByLabelText("Captcha answer"), { target: { value: "a7b9" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and link Google" }));

    await waitFor(() => expect(store.authenticated).toBe(true));
    expect(mutate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        variables: {
          input: {
            idToken: "google-id-token",
            link: {
              password: "correct-password",
              captchaToken: "captcha-token",
              captchaAnswer: "a7b9",
            },
          },
        },
      }),
    );
  });

  it("refreshes captcha after a failed link and clears the pending token when cancelled", async () => {
    let captchaRequests = 0;
    let googleAttempts = 0;
    vi.spyOn(apolloClient, "mutate").mockImplementation(async (options) => {
      if (options.mutation === REQUEST_CAPTCHA) {
        captchaRequests += 1;
        return captchaResult(`captcha-${captchaRequests}`) as never;
      }
      if (options.mutation === WEB_GOOGLE_LOGIN) {
        googleAttempts += 1;
        if (googleAttempts === 1) {
          throw { errors: [{ extensions: { code: "GOOGLE_ACCOUNT_LINK_REQUIRED" } }] };
        }
        throw new Error("Bad link proof");
      }
      throw new Error("Unexpected mutation");
    });
    renderAuth();
    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
    await screen.findByText("This email already has a TK Copilot account");
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.change(screen.getByLabelText("Captcha answer"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and link Google" }));

    await waitFor(() => expect(captchaRequests).toBe(2));
    expect(
      screen.getByText("We could not verify and link this account. Please try again."),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel Google linking" }));
    expect(await screen.findByLabelText("Email")).not.toBeNull();
    expect(screen.queryByText("This email already has a TK Copilot account")).toBeNull();
  });

  it("deduplicates repeated GIS callbacks", async () => {
    let resolveGoogle: ((value: ReturnType<typeof googleResult>) => void) | undefined;
    const googlePromise = new Promise<ReturnType<typeof googleResult>>((resolve) => {
      resolveGoogle = resolve;
    });
    let requests = 0;
    vi.spyOn(apolloClient, "mutate").mockImplementation(async (options) => {
      if (options.mutation === REQUEST_CAPTCHA) return captchaResult() as never;
      if (options.mutation === WEB_GOOGLE_LOGIN) {
        requests += 1;
        return googlePromise as never;
      }
      throw new Error("Unexpected mutation");
    });
    renderAuth();
    await screen.findByRole("button", { name: "Continue with Google" });
    googleCallback?.({ credential: "google-id-token" });
    googleCallback?.({ credential: "google-id-token" });
    expect(requests).toBe(1);
    resolveGoogle?.(googleResult());
    await waitFor(() => expect(getAccessToken()).toBe("tk-access-token"));
    googleCallback?.({ credential: "google-id-token" });
    expect(requests).toBe(1);
  });

  it("keeps password login and registration available, including RTL rendering", async () => {
    vi.spyOn(apolloClient, "mutate").mockImplementation(async (options) => {
      if (options.mutation === REQUEST_CAPTCHA) return captchaResult() as never;
      if (options.mutation === WEB_LOGIN || options.mutation === WEB_REGISTER) {
        return {
          data: {
            webLogin: {
              accessToken: "password-access-token",
              user: { email: "operator@example.com" },
            },
          },
        } as never;
      }
      throw new Error("Unexpected mutation");
    });
    const store = renderAuth("ar");
    await screen.findByRole("button", { name: "Continue with Google" });
    expect(document.documentElement.dir).toBe("rtl");
    googleCallback?.({});
    await waitFor(() => expect(store.error).toContain("Google"));

    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), {
      target: { value: "operator@example.com" },
    });
    fireEvent.change(screen.getByLabelText("كلمة المرور"), {
      target: { value: "password-123" },
    });
    fireEvent.change(screen.getByLabelText("Captcha answer"), { target: { value: "abcd" } });
    fireEvent.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    await waitFor(() => expect(store.authenticated).toBe(true));
  });

  it("keeps account registration available beside Google sign-in", async () => {
    const mutate = vi.spyOn(apolloClient, "mutate").mockImplementation(async (options) => {
      if (options.mutation === REQUEST_CAPTCHA) return captchaResult() as never;
      if (options.mutation === WEB_REGISTER) {
        return {
          data: {
            webRegister: {
              accessToken: "register-access-token",
              user: { email: "new@example.com" },
            },
          },
        } as never;
      }
      throw new Error("Unexpected mutation");
    });
    const store = renderAuth();
    fireEvent.click(await screen.findByRole("button", { name: "New here? Create an account" }));
    expect(screen.getByRole("button", { name: "Continue with Google" })).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Operator" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password-123" } });
    fireEvent.change(screen.getByLabelText("Captcha answer"), { target: { value: "abcd" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(store.authenticated).toBe(true));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: WEB_REGISTER,
        variables: {
          input: {
            name: "New Operator",
            email: "new@example.com",
            password: "password-123",
            captchaToken: "captcha-token",
            captchaAnswer: "abcd",
          },
        },
      }),
    );
  });
});
