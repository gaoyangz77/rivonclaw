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
  SET_AFFILIATE_BUSINESS_DEVELOPER_LOGIN_DISABLED_MUTATION,
} from "../../../api/shops-queries.js";
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

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("AffiliateBusinessDeveloperLoginPanel", () => {
  it("creates a login from the email and initial password and shows it as active", async () => {
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
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Sign-in email"), {
      target: { value: " maria@example.com " },
    });
    fireEvent.change(within(dialog).getByLabelText("Initial password"), {
      target: { value: "s3cret" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create login" }));

    await waitFor(() => expect(result).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("maria@example.com")).toBeTruthy());
    expect(workspace.getBusinessDeveloper("bd-1")?.login?.email).toBe("maria@example.com");
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset password" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Disable" })).toBeTruthy();
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
