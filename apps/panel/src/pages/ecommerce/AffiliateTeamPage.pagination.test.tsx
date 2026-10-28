// @vitest-environment jsdom
import { MockedProvider } from "@apollo/client/testing/react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import i18n from "../../i18n/index.js";
import { ToastProvider } from "../../components/Toast.js";
import { WorkspaceTabProvider } from "../../lib/workspace-tab-context.js";
import {
  AFFILIATE_BUSINESS_DEVELOPERS_QUERY,
  AFFILIATE_BUSINESS_DEVELOPER_PAGE_QUERY,
  AFFILIATE_CREATOR_PROTECTIONS_QUERY,
  AFFILIATE_OPERATIONAL_SETTINGS_QUERY,
  CREATOR_MANUAL_TAGS_QUERY,
  EMAIL_ACCOUNT_BINDINGS_QUERY,
  WHATSAPP_ACCOUNT_BINDINGS_QUERY,
} from "../../api/shops-queries.js";
import { AffiliateTeamPage } from "./AffiliateTeamPage.js";

const store = vi.hoisted(() => ({
  channelAccounts: [],
  affiliateWorkspace: {
    businessDevelopers: [],
    whatsappAccounts: [],
    emailAccounts: [],
    operationalSettings: null,
    replaceAffiliateBusinessDevelopers: vi.fn(),
    setAffiliateOperationalSettings: vi.fn(),
    replaceAffiliateWhatsAppAccounts: vi.fn(),
    replaceAffiliateEmailAccounts: vi.fn(),
  },
}));
vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => store }));
vi.mock("./hooks/useDeviceBinding.js", () => ({ useMyDeviceId: () => null }));
vi.mock("../../api/channels.js", () => ({
  fetchChannelStatus: vi.fn().mockResolvedValue(null),
  fetchAllowlist: vi.fn(),
}));
// These independent panels mount in hidden tabs; keep the test on the roster's real queries/UI.
vi.mock("./components/AffiliateApprovalPolicyPanel.js", () => ({
  AffiliateApprovalPolicyPanel: () => null,
}));
vi.mock("./components/AffiliateMessageLookbackPanel.js", () => ({
  AffiliateMessageLookbackPanel: () => null,
}));
vi.mock("./components/AffiliateCreatorTagCatalogPanel.js", () => ({
  AffiliateCreatorTagCatalogPanel: () => null,
}));

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

const developers = Array.from({ length: 35 }, (_, index) => ({
  __typename: "AffiliateBusinessDeveloper" as const,
  id: `bd-${index + 1}`,
  userId: "seller",
  displayName: `BD ${String(index + 1).padStart(2, "0")}`,
  creatorDisplayName: null,
  normalizedDisplayName: `bd ${index + 1}`,
  regions: [],
  acceptingCreators: false,
  creatorIntakeLimitsEnabled: false,
  weeklyCreatorLimit: 100,
  monthlyCreatorLimit: 500,
  agentAssistanceMode: GQL.AffiliateAgentAssistanceMode.AiAssisted,
  businessPrompt: null,
  profileStatus: GQL.AffiliateBusinessDeveloperProfileStatus.Ready,
  provisioningSource: GQL.AffiliateBusinessDeveloperProvisioningSource.Manual,
  profileConfirmedAt: null,
  preferredWhatsAppAccountBindingId: null,
  preferredEmailAccountBindingId: null,
  deviceId: null,
  escalationChannelId: null,
  escalationRecipientId: null,
  configRevision: 1,
  archivedAt: null,
  createdAt: "2026-10-28T00:00:00Z",
  updatedAt: "2026-10-28T00:00:00Z",
  login: null,
}));

function roster(totalCount = 35) {
  return (offset: number) => ({
    affiliateBusinessDeveloperPage: {
      items: developers.slice(offset, Math.min(offset + 25, totalCount)).map((developer) => ({
        developer,
        creatorRelationshipCount: 0,
        whatsappAccountCount: 0,
        unhealthyWhatsappAccountCount: 0,
        emailAccountCount: 0,
        unhealthyEmailAccountCount: 0,
      })),
      totalCount,
      offset,
      limit: 25,
    },
  });
}

function renderRoster({ failSecondPage = false, shrinkOnRefresh = false } = {}) {
  const pageRequests: number[] = [];
  const totals = new Map<number, number>();
  let totalCount = 35;
  const mocks = [
    ...[0, 25].map((offset) => ({
      request: {
        query: AFFILIATE_BUSINESS_DEVELOPER_PAGE_QUERY,
        variables: { input: { offset, limit: 25, search: null, includeArchived: false } },
      },
      delay: 25,
      maxUsageCount: 5,
      ...(failSecondPage && offset === 25
        ? { error: new Error("Roster unavailable") }
        : {
            result: () => {
              pageRequests.push(offset);
              const calls = (totals.get(offset) ?? 0) + 1;
              totals.set(offset, calls);
              if (shrinkOnRefresh && offset === 25 && calls > 1) totalCount = 20;
              return { data: roster(totalCount)(offset) };
            },
          }),
    })),
    {
      request: { query: AFFILIATE_BUSINESS_DEVELOPERS_QUERY, variables: { includeArchived: true } },
      result: { data: { affiliateBusinessDevelopers: developers } },
      maxUsageCount: 5,
    },
    {
      request: { query: AFFILIATE_OPERATIONAL_SETTINGS_QUERY },
      result: {
        data: {
          affiliateOperationalSettings: {
            id: "settings",
            userId: "seller",
            unrepliedMessageLookbackDays: 7,
            onboardingCompletedAt: null,
          },
        },
      },
      maxUsageCount: 5,
    },
    {
      request: {
        query: AFFILIATE_CREATOR_PROTECTIONS_QUERY,
        variables: {
          input: {
            offset: 0,
            limit: 25,
            search: null,
            businessDeveloperId: null,
            resolution: null,
          },
        },
      },
      result: {
        data: {
          affiliateCreatorProtections: {
            items: [],
            totalCount: 0,
            resolvedCount: 0,
            unresolvedCount: 0,
            businessDeveloperCounts: [],
            offset: 0,
            limit: 25,
          },
        },
      },
    },
    {
      request: { query: CREATOR_MANUAL_TAGS_QUERY, variables: { input: {} } },
      result: { data: { creatorManualTags: [] } },
    },
    {
      request: { query: WHATSAPP_ACCOUNT_BINDINGS_QUERY },
      result: { data: { whatsAppAccountBindings: [] } },
      maxUsageCount: 5,
    },
    {
      request: { query: EMAIL_ACCOUNT_BINDINGS_QUERY },
      result: { data: { emailAccountBindings: [] } },
      maxUsageCount: 5,
    },
  ];
  render(
    <MockedProvider mocks={mocks}>
      <WorkspaceTabProvider
        value={{ tabId: "team", active: true, view: {}, setView: vi.fn(), setDirty: vi.fn() }}
      >
        <ToastProvider>
          <AffiliateTeamPage />
        </ToastProvider>
      </WorkspaceTabProvider>
    </MockedProvider>,
  );
  return pageRequests;
}

const next = () => screen.getByRole("button", { name: i18n.t("ecommerce.affiliateTeam.nextPage") });
const previous = () =>
  screen.getByRole("button", { name: i18n.t("ecommerce.affiliateTeam.previousPage") });

describe("BD roster pagination", () => {
  it("loads the uncached second page without resetting and returns to the cached first page", async () => {
    const requests = renderRoster();
    await screen.findByText("BD 01");
    await waitFor(() => expect(previous()).toHaveProperty("disabled", true));
    expect(next()).toHaveProperty("disabled", false);
    fireEvent.click(next());
    await screen.findByText("BD 26");
    expect(screen.queryByText("BD 01")).toBeNull();
    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(next()).toHaveProperty("disabled", true);
    expect(previous()).toHaveProperty("disabled", false);
    fireEvent.click(previous());
    expect(previous()).toHaveProperty("disabled", true);
    expect(next()).toHaveProperty("disabled", true);
    await waitFor(() => expect(next()).toHaveProperty("disabled", false));
    expect(screen.getByText("BD 01")).toBeTruthy();
    expect(screen.queryByText("BD 26")).toBeNull();
    expect(requests).toEqual([0, 25, 0]);
  });

  it("does not mistake a failed page request for a smaller result set", async () => {
    const requests = renderRoster({ failSecondPage: true });
    await screen.findByText("BD 01");
    fireEvent.click(next());
    await screen.findByRole("heading", {
      name: i18n.t("ecommerce.affiliateTeam.emptyDevelopersTitle"),
    });
    expect(screen.queryByText("BD 01")).toBeNull();
    expect(requests).toEqual([0]);
  });

  it("still clamps an out-of-range page after a successful refresh confirms the total shrank", async () => {
    const requests = renderRoster({ shrinkOnRefresh: true });
    await screen.findByText("BD 01");
    fireEvent.click(next());
    await screen.findByText("BD 26");
    fireEvent.click(screen.getByRole("button", { name: i18n.t("common.refresh") }));
    await waitFor(() => expect(previous()).toHaveProperty("disabled", true));
    await screen.findByText("BD 01");
    await waitFor(() => expect(requests).toEqual([0, 25, 25, 0]));
    expect(screen.getByText("1 / 1")).toBeTruthy();
  });
});
