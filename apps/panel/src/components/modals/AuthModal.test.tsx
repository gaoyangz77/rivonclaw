import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../api/client.js", () => ({
  fetchJson: mocks.fetchJson,
}));

vi.mock("../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({
    login: mocks.login,
    register: mocks.register,
  }),
}));

vi.mock("../Toast.js", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("./Modal.js", () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));

import { AuthModal } from "./AuthModal.js";

function pathIncludes(path: unknown, suffix: string): boolean {
  return typeof path === "string" && path.includes(suffix);
}

function installDefaultResponses(status: "pending" | "completed" | "link_required" = "pending") {
  mocks.fetchJson.mockImplementation(async (path: unknown) => {
    if (pathIncludes(path, "/request-captcha")) {
      return { token: "captcha-token", svg: "<svg></svg>" };
    }
    if (pathIncludes(path, "/google/config")) return { enabled: true };
    if (pathIncludes(path, "/google/start")) return { flowId: "flow-1", status: "pending" };
    if (pathIncludes(path, "/google/status")) return { flowId: "flow-1", status };
    if (pathIncludes(path, "/google/link")) return { flowId: "flow-1", status: "completed" };
    if (pathIncludes(path, "/google/cancel")) return { flowId: "flow-1", status: "cancelled" };
    if (pathIncludes(path, "/browser/start")) {
      return { flowId: "browser-flow-1", status: "pending" };
    }
    if (pathIncludes(path, "/browser/status")) {
      return { flowId: "browser-flow-1", status };
    }
    if (pathIncludes(path, "/browser/cancel")) {
      return { flowId: "browser-flow-1", status: "cancelled" };
    }
    throw new Error(`Unexpected path: ${String(path)}`);
  });
}

describe("AuthModal Google sign-in", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mocks.fetchJson.mockReset();
    mocks.login.mockReset();
    mocks.register.mockReset();
    mocks.showToast.mockReset();
  });

  it("shows the branded button only when the backend enables Desktop Google sign-in", async () => {
    installDefaultResponses();
    render(<AuthModal isOpen onClose={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "auth.googleContinue" })).toBeTruthy();
    expect(screen.getByText("auth.googleDivider")).toBeTruthy();
  });

  it("completes a browser-to-desktop login without entering credentials in the modal", async () => {
    installDefaultResponses("completed");
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<AuthModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "auth.browserLoginContinue" }),
    );
    await waitFor(() => {
      const startCall = mocks.fetchJson.mock.calls.find(([path]) =>
        pathIncludes(path, "/browser/start"));
      expect(JSON.parse(startCall![1].body)).toEqual({ intent: "LOGIN" });
    });
    expect(await screen.findByText("auth.browserLoginWaiting")).toBeTruthy();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1), { timeout: 2_000 });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.showToast).toHaveBeenCalledWith("auth.browserLoginSuccess");
  });

  it("opens browser registration when the registration tab is active", async () => {
    installDefaultResponses();
    render(<AuthModal isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "auth.register" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "auth.browserRegisterContinue" }),
    );

    await waitFor(() => {
      const startCall = mocks.fetchJson.mock.calls.find(([path]) =>
        pathIncludes(path, "/browser/start"));
      expect(JSON.parse(startCall![1].body)).toEqual({ intent: "REGISTER" });
    });
  });

  it("deduplicates start clicks and completes after the main-process status changes", async () => {
    installDefaultResponses("completed");
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<AuthModal isOpen onClose={onClose} onSuccess={onSuccess} />);
    const button = await screen.findByRole("button", { name: "auth.googleContinue" });

    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => {
      const starts = mocks.fetchJson.mock.calls.filter(([path]) =>
        pathIncludes(path, "/google/start"));
      expect(starts).toHaveLength(1);
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1), { timeout: 2_000 });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.showToast).toHaveBeenCalledWith("auth.googleSuccess");
  });

  it("switches to password and captcha verification for an existing account", async () => {
    installDefaultResponses("link_required");
    const onSuccess = vi.fn();
    render(<AuthModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />);
    fireEvent.click(await screen.findByRole("button", { name: "auth.googleContinue" }));

    expect(await screen.findByText("auth.googleLinkTitle", {}, { timeout: 2_000 })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("auth.password"), {
      target: { value: "original-password" },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.captchaPlaceholder"), {
      target: { value: "ABCD" },
    });
    fireEvent.click(screen.getByRole("button", { name: "auth.googleLinkAction" }));

    await waitFor(() => {
      const linkCall = mocks.fetchJson.mock.calls.find(([path]) =>
        pathIncludes(path, "/google/link"));
      expect(linkCall).toBeDefined();
      expect(JSON.parse(linkCall![1].body)).toEqual({
        flowId: "flow-1",
        password: "original-password",
        captchaToken: "captcha-token",
        captchaAnswer: "ABCD",
      });
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("keeps email/password login available when Google config fails", async () => {
    mocks.fetchJson.mockImplementation(async (path: unknown) => {
      if (pathIncludes(path, "/request-captcha")) {
        return { token: "captcha-token", svg: "<svg></svg>" };
      }
      if (pathIncludes(path, "/google/config")) throw new Error("offline");
      throw new Error(`Unexpected path: ${String(path)}`);
    });
    mocks.login.mockResolvedValue(undefined);
    render(<AuthModal isOpen onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "auth.googleContinue" })).toBeNull();
    });
    fireEvent.change(screen.getByRole("textbox", { name: "auth.email" }), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("auth.captchaPlaceholder"), {
      target: { value: "ABCD" },
    });
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "auth.loginAction" }));

    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password",
      captchaToken: "captcha-token",
      captchaAnswer: "ABCD",
    }));
  });
});
