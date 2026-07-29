import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("GoogleSignInButton", () => {
  afterEach(() => {
    document.getElementById("google-identity-services")?.remove();
    delete window.google;
    vi.resetModules();
  });

  it("loads GIS once and initializes the localized official button", async () => {
    const initialize = vi.fn();
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize, renderButton } } };
    const { GoogleSignInButton } = await import("./GoogleSignInButton.js");

    const { rerender } = render(
      <GoogleSignInButton
        clientId="web-client-id"
        language="zh"
        loadingLabel="加载中"
        onCredential={vi.fn()}
        onError={vi.fn()}
      />,
    );

    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "web-client-id",
        ux_mode: "popup",
        auto_select: false,
      }),
    );
    expect(renderButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ locale: "zh", text: "continue_with" }),
    );

    rerender(
      <GoogleSignInButton
        clientId="web-client-id"
        language="ar"
        loadingLabel="جارٍ التحميل"
        onCredential={vi.fn()}
        onError={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(renderButton).toHaveBeenLastCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ locale: "ar" }),
      ),
    );
  });

  it("reports a script load failure without replacing the surrounding UI", async () => {
    const onError = vi.fn();
    const { GoogleSignInButton } = await import("./GoogleSignInButton.js");
    render(
      <GoogleSignInButton
        clientId="web-client-id"
        language="en"
        loadingLabel="Loading"
        onCredential={vi.fn()}
        onError={onError}
      />,
    );

    const script = document.getElementById("google-identity-services");
    expect(script).toBeInstanceOf(HTMLScriptElement);
    script!.dispatchEvent(new Event("error"));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });
});
