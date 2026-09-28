import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { GraphQLError } from "graphql";
import { AffiliateWorkspaceModel } from "@rivonclaw/core/models";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import {
  PROVISION_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MUTATION,
  REMOVE_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MUTATION,
  RESET_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_PASSWORD_MUTATION,
  SET_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_DISABLED_MUTATION,
} from "../../../api/shops-queries.js";
import {
  GENERATED_LOGIN_PASSWORD_LENGTH,
  LOGIN_PASSWORD_ALPHABET,
} from "../affiliate-login-credentials.js";
import { AffiliateBusinessDeveloperLoginPanel } from "./AffiliateBusinessDeveloperLoginPanel.js";

const mocks = vi.hoisted(() => ({ entityStore: null as unknown }));

vi.mock("../../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => mocks.entityStore,
}));

const NOW = "2026-09-28T00:00:00.000Z";

type Login = { userId: string; email: string; disabled: boolean } | null;

/** A developer as the AffiliateBusinessDeveloperFields fragment returns it. */
function developer(overrides: { archivedAt?: string | null; login?: Login } = {}) {
  const login = overrides.login === undefined ? null : overrides.login;
  return {
    __typename: "AffiliateBusinessDeveloper",
    id: "bd-1",
    userId: "owner-1",
    displayName: "Maria",
    creatorDisplayName: null,
    normalizedDisplayName: "maria",
    regions: [],
    acceptingCreators: true,
    agentAssistanceMode: "AI_ASSISTED",
    businessPrompt: null,
    profileStatus: "READY",
    provisioningSource: "MANUAL",
    profileConfirmedAt: null,
    preferredWhatsAppAccountBindingId: null,
    preferredEmailAccountBindingId: null,
    deviceId: "device-1",
    escalationChannelId: null,
    escalationRecipientId: null,
    configRevision: 1,
    archivedAt: overrides.archivedAt ?? null,
    createdAt: NOW,
    updatedAt: NOW,
    login: login ? { __typename: "AffiliateBusinessDeveloperLogin", ...login } : null,
  };
}

function seedStore(seed: ReturnType<typeof developer>) {
  const affiliateWorkspace = AffiliateWorkspaceModel.create({});
  affiliateWorkspace.replaceAffiliateBusinessDevelopers([seed] as never);
  mocks.entityStore = { affiliateWorkspace };
  return affiliateWorkspace;
}

function renderPanel(apolloMocks: ReadonlyArray<Record<string, unknown>> = []) {
  return render(
    <MockedProvider mocks={apolloMocks as never}>
      <ToastProvider>
        <AffiliateBusinessDeveloperLoginPanel developerId="bd-1" />
      </ToastProvider>
    </MockedProvider>,
  );
}

const ACTIVE_LOGIN = { userId: "member-1", email: "maria@example.com", disabled: false };

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(async () => {
  await i18n.changeLanguage("en");
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "clipboard");
});

const CREDENTIALS_NOTE =
  "The password cannot be shown again after you close this. Copy it and send it to the BD first.";

describe("AffiliateBusinessDeveloperLoginPanel", () => {
  it("prefills a generated password that can be regenerated", () => {
    seedStore(developer());
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Create login" }));
    const dialog = screen.getByRole("dialog");
    const field = within(dialog).getByLabelText("Initial password") as HTMLInputElement;
    const generated = field.value;
    expect(field.type).toBe("text");
    expect(generated).toHaveLength(GENERATED_LOGIN_PASSWORD_LENGTH);
    expect(Array.from(generated).every((char) => LOGIN_PASSWORD_ALPHABET.includes(char))).toBe(
      true,
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Regenerate" }));
    expect(field.value).toHaveLength(GENERATED_LOGIN_PASSWORD_LENGTH);
    expect(field.value).not.toBe(generated);
  });

  it("creates a login and shows its login info once, with a copy-all message", async () => {
    const workspace = seedStore(developer());
    const input = { businessDeveloperId: "bd-1", email: "maria@example.com", password: "s3cret" };
    const result = vi.fn(() => ({
      data: { provisionAffiliateBusinessDeveloperLogin: developer({ login: ACTIVE_LOGIN }) },
    }));
    renderPanel([
      {
        request: {
          query: PROVISION_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MUTATION,
          variables: { input },
        },
        result,
      },
    ]);

    expect(screen.getByText("No login")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create login" }));
    const form = screen.getByRole("dialog");
    fireEvent.change(within(form).getByLabelText("Sign-in email"), {
      target: { value: " maria@example.com " },
    });
    fireEvent.change(within(form).getByLabelText("Initial password"), {
      target: { value: "s3cret" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Create login" }));

    await waitFor(() => expect(result).toHaveBeenCalledTimes(1));
    const card = await screen.findByRole("dialog", { name: "Login info for Maria" });
    expect(within(card).getByText(CREDENTIALS_NOTE)).toBeTruthy();
    expect(within(card).getByText("maria@example.com")).toBeTruthy();
    expect(within(card).getByText("s3cret")).toBeTruthy();
    expect(workspace.getBusinessDeveloper("bd-1")?.login?.email).toBe("maria@example.com");

    fireEvent.click(within(card).getByRole("button", { name: "Copy all" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenLastCalledWith(
      [
        "TK Copilot login for Maria",
        "Open the TK Copilot desktop app and sign in with this email and password.",
        "Email: maria@example.com",
        "Password: s3cret",
      ].join("\n"),
    );
    expect(await screen.findByText("Login info copied.")).toBeTruthy();

    fireEvent.click(within(card).getByRole("button", { name: "Copy password" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("s3cret"));

    fireEvent.click(within(card).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText("s3cret")).toBeNull();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("maria@example.com")).toBeTruthy();

    // Reopening the flow never brings the old password back.
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    const reset = screen.getByRole("dialog");
    expect(within(reset).queryByText("s3cret")).toBeNull();
    expect((within(reset).getByLabelText("New password") as HTMLInputElement).value).not.toBe(
      "s3cret",
    );
  });

  it("copy-all writes the login info in the display language", async () => {
    seedStore(developer());
    const input = { businessDeveloperId: "bd-1", email: "maria@example.com", password: "s3cret" };
    renderPanel([
      {
        request: {
          query: PROVISION_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MUTATION,
          variables: { input },
        },
        result: {
          data: { provisionAffiliateBusinessDeveloperLogin: developer({ login: ACTIVE_LOGIN }) },
        },
      },
    ]);
    await i18n.changeLanguage("zh");

    fireEvent.click(screen.getByRole("button", { name: "创建登录账号" }));
    const form = screen.getByRole("dialog");
    fireEvent.change(within(form).getByLabelText("登录邮箱"), {
      target: { value: "maria@example.com" },
    });
    fireEvent.change(within(form).getByLabelText("初始密码"), { target: { value: "s3cret" } });
    fireEvent.click(within(form).getByRole("button", { name: "创建登录账号" }));

    const card = await screen.findByRole("dialog", { name: "Maria 的登录信息" });
    expect(within(card).getByText("关闭后将无法再次查看密码，请先复制发给 BD。")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "复制全部" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith(
        [
          "Maria 的 TK匠 登录信息",
          "打开 TK匠 桌面端，使用以下邮箱和密码登录。",
          "邮箱: maria@example.com",
          "密码: s3cret",
        ].join("\n"),
      ),
    );
  });

  it("resets the password and shows a new login info card", async () => {
    seedStore(developer({ login: ACTIVE_LOGIN }));
    const result = vi.fn(() => ({
      data: { resetAffiliateBusinessDeveloperLoginPassword: developer({ login: ACTIVE_LOGIN }) },
    }));
    renderPanel([
      {
        request: {
          query: RESET_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_PASSWORD_MUTATION,
          variables: { businessDeveloperId: "bd-1", password: "n3w-secret" },
        },
        result,
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    const form = screen.getByRole("dialog");
    fireEvent.change(within(form).getByLabelText("New password"), {
      target: { value: "n3w-secret" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Set new password" }));

    await waitFor(() => expect(result).toHaveBeenCalledTimes(1));
    const card = await screen.findByRole("dialog", { name: "Login info for Maria" });
    expect(within(card).getByText("maria@example.com")).toBeTruthy();
    expect(within(card).getByText("n3w-secret")).toBeTruthy();

    fireEvent.click(within(card).getByRole("button", { name: "Copy email" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("maria@example.com"));
  });

  it("copies the login email of an existing login", async () => {
    seedStore(developer({ login: ACTIVE_LOGIN }));
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Copy email" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("maria@example.com"));
    expect(await screen.findByText("Email copied.")).toBeTruthy();
  });

  it("says so when the clipboard refuses", async () => {
    seedStore(developer({ login: ACTIVE_LOGIN }));
    writeText.mockRejectedValue(new Error("denied"));
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Copy email" }));

    expect(
      await screen.findByText("Could not copy. Select the text and copy it manually."),
    ).toBeTruthy();
  });

  it("explains a refusal by its error code instead of the raw backend message", async () => {
    seedStore(developer());
    const input = { businessDeveloperId: "bd-1", email: "maria@example.com", password: "s3cret" };
    renderPanel([
      {
        request: {
          query: PROVISION_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MUTATION,
          variables: { input },
        },
        result: {
          errors: [
            new GraphQLError("This business developer already has a login", {
              extensions: { code: "AFFILIATE_BUSINESS_DEVELOPER_LOGIN_EXISTS" },
            }),
          ],
        },
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Create login" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Sign-in email"), {
      target: { value: "maria@example.com" },
    });
    fireEvent.change(within(dialog).getByLabelText("Initial password"), {
      target: { value: "s3cret" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create login" }));

    expect(await screen.findByText("This BD already has a login. Refresh to see it.")).toBeTruthy();
  });

  it("disables an active login", async () => {
    const workspace = seedStore(developer({ login: ACTIVE_LOGIN }));
    const result = vi.fn(() => ({
      data: {
        setAffiliateBusinessDeveloperLoginDisabled: developer({
          login: { ...ACTIVE_LOGIN, disabled: true },
        }),
      },
    }));
    renderPanel([
      {
        request: {
          query: SET_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_DISABLED_MUTATION,
          variables: { businessDeveloperId: "bd-1", disabled: true },
        },
        result,
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Disable" }));

    await waitFor(() => expect(workspace.getBusinessDeveloper("bd-1")?.login?.disabled).toBe(true));
    expect(await screen.findByRole("button", { name: "Enable" })).toBeTruthy();
    expect(screen.getByText("Disabled")).toBeTruthy();
  });

  it("does not offer to enable the disabled login of an archived BD, and says why", () => {
    seedStore(developer({ archivedAt: NOW, login: { ...ACTIVE_LOGIN, disabled: true } }));
    renderPanel();

    expect((screen.getByRole("button", { name: "Enable" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByText(/Restoring the BD does not enable it again/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Remove login" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("does not offer to create a login for an archived BD", () => {
    seedStore(developer({ archivedAt: NOW }));
    renderPanel();

    expect(
      (screen.getByRole("button", { name: "Create login" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/An archived BD cannot get a login/)).toBeTruthy();
  });

  it("removes the login only after confirmation", async () => {
    const workspace = seedStore(developer({ login: ACTIVE_LOGIN }));
    const result = vi.fn(() => ({
      data: { removeAffiliateBusinessDeveloperLogin: developer({ login: null }) },
    }));
    renderPanel([
      {
        request: {
          query: REMOVE_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_MUTATION,
          variables: { businessDeveloperId: "bd-1" },
        },
        result,
      },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Remove login" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Remove the login maria@example.com\?/)).toBeTruthy();
    expect(result).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove login" }));

    await waitFor(() => expect(workspace.getBusinessDeveloper("bd-1")?.login).toBeNull());
    expect(await screen.findByText("No login")).toBeTruthy();
  });
});
