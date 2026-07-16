// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  AFFILIATE_OUTREACH_OPERATIONAL_STATUS_QUERY,
  EMAIL_ACCOUNT_BINDINGS_QUERY,
  MICROSOFT_GRAPH_CONNECTOR_STATUS_QUERY,
  WHATSAPP_ACCOUNT_BINDINGS_QUERY,
  WHATSAPP_CONNECTOR_STATUS_QUERY,
  WHATSAPP_PROXIES_QUERY,
} from "../../../api/shops-queries.js";
import { AffiliateEmailAccountPanel } from "./AffiliateEmailAccountPanel.js";
import { AffiliateOutreachOpsPanel } from "./AffiliateManagementTab.js";
import { AffiliateWhatsAppAccountPanel } from "./AffiliateWhatsAppAccountPanel.js";

const toastMock = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

const eventBusMock = vi.hoisted(() => ({
  subscribe: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

vi.mock("../../../components/Toast.js", () => ({
  useToast: () => toastMock,
}));

vi.mock("../../../lib/event-bus.js", () => ({
  panelEventBus: eventBusMock,
}));

vi.mock("@apollo/client/react", async () => {
  const actual = await vi.importActual<typeof import("@apollo/client/react")>("@apollo/client/react");
  return {
    ...actual,
    useMutation: vi.fn(),
    useQuery: vi.fn(),
  };
});

const mutationSpy = vi.fn();
const refetchSpy = vi.fn();

function mockMutationHooks() {
  vi.mocked(useMutation).mockImplementation(() => [mutationSpy, { loading: false, called: false, reset: vi.fn() }] as never);
}

function renderWhatsAppPanel(
  status: Partial<WhatsAppConnectorStatus>,
  props: ComponentProps<typeof AffiliateWhatsAppAccountPanel> = {},
) {
  vi.mocked(useQuery).mockImplementation((query) => {
    if (query === WHATSAPP_ACCOUNT_BINDINGS_QUERY) {
      return {
        data: {
          whatsAppAccountBindings: [
            {
              id: "wa-1",
              displayName: "Seller WhatsApp",
              evolutionInstanceName: "wa_instance_1",
              lastError: null,
              phoneNumber: "15551234567",
              status: GQL.WhatsAppAccountStatus.PendingQr,
            },
          ],
        },
        loading: false,
        refetch: refetchSpy,
      } as never;
    }
    if (query === WHATSAPP_PROXIES_QUERY) {
      return {
        data: { whatsAppProxies: [] },
        loading: false,
        refetch: refetchSpy,
      } as never;
    }
    if (query === WHATSAPP_CONNECTOR_STATUS_QUERY) {
      return {
        data: {
          whatsAppConnectorStatus: {
            configured: true,
            reachable: true,
            ready: true,
            httpStatus: 200,
            licenseRequired: false,
            message: null,
            accountCounts: [],
            proxyCounts: [],
            ...status,
          },
        },
        loading: false,
        refetch: refetchSpy,
      } as never;
    }
    throw new Error("Unexpected WhatsApp query");
  });
  return render(<AffiliateWhatsAppAccountPanel {...props} />);
}

function renderEmailPanel(status: Partial<MicrosoftGraphConnectorStatus>) {
  vi.mocked(useQuery).mockImplementation((query) => {
    if (query === EMAIL_ACCOUNT_BINDINGS_QUERY) {
      return {
        data: { emailAccountBindings: [] },
        loading: false,
        refetch: refetchSpy,
      } as never;
    }
    if (query === MICROSOFT_GRAPH_CONNECTOR_STATUS_QUERY) {
      return {
        data: {
          microsoftGraphConnectorStatus: {
            configured: true,
            oauthConfigured: true,
            webhookConfigured: true,
            ready: true,
            message: null,
            accountCounts: [],
            subscriptionCounts: [],
            ...status,
          },
        },
        loading: false,
        refetch: refetchSpy,
      } as never;
    }
    throw new Error("Unexpected email query");
  });
  return render(<AffiliateEmailAccountPanel />);
}

function renderOpsPanel(status: Partial<AffiliateOutreachOperationalStatus>) {
  vi.mocked(useQuery).mockImplementation((query) => {
    if (query === AFFILIATE_OUTREACH_OPERATIONAL_STATUS_QUERY) {
      return {
        data: {
          affiliateOutreachOperationalStatus: {
            since: "2026-06-24T12:00:00.000Z",
            failedDeliveryCount: 2,
            webhookReceivedCount: 11,
            ignoredWebhookCount: 1,
            rejectedWebhookCount: 4,
            mailboxSyncCount: 7,
            failedMailboxSyncCount: 1,
            subscriptionRenewalCount: 5,
            failedSubscriptionRenewalCount: 2,
            activeWhatsAppProxyCount: 6,
            disabledWhatsAppProxyCount: 2,
            errorWhatsAppProxyCount: 1,
            whatsappAccountsUsingUnavailableProxyCount: 2,
            whatsappAccountsNeedingReconnectCount: 1,
            emailAccountsMissingRefreshTokenCount: 2,
            sharedEmailAccountsMissingAddressCount: 1,
            latestDeliveryAt: "2026-07-01T11:00:00.000Z",
            latestInboundAt: "2026-07-01T11:30:00.000Z",
            latestOperationalEventAt: "2026-07-01T11:40:00.000Z",
            deliveryCounts: [
              {
                channel: GQL.AffiliateMessageChannel.Whatsapp,
                status: GQL.AffiliateDeliveryStatus.Sent,
                count: 4,
              },
              {
                channel: GQL.AffiliateMessageChannel.Email,
                status: GQL.AffiliateDeliveryStatus.Sent,
                count: 5,
              },
            ],
            inboundCounts: [
              {
                channel: GQL.AffiliateMessageChannel.Whatsapp,
                direction: GQL.AffiliateCreatorMessageDirection.Creator,
                count: 8,
              },
              {
                channel: GQL.AffiliateMessageChannel.Email,
                direction: GQL.AffiliateCreatorMessageDirection.Creator,
                count: 9,
              },
            ],
            operationalEventCounts: [],
            operationalEventTypeCounts: [],
            ...status,
          },
        },
        loading: false,
        refetch: refetchSpy,
      } as never;
    }
    throw new Error("Unexpected ops query");
  });
  return render(<AffiliateOutreachOpsPanel shopId="shop-1" />);
}

beforeEach(() => {
  mutationSpy.mockReset();
  refetchSpy.mockReset();
  eventBusMock.subscribe.mockReset();
  eventBusMock.subscribe.mockReturnValue(vi.fn());
  toastMock.showToast.mockReset();
  vi.mocked(useQuery).mockReset();
  vi.mocked(useMutation).mockReset();
  mockMutationHooks();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("affiliate outreach connector onboarding gates", () => {
  it("disables WhatsApp QR onboarding while Evolution is not ready", () => {
    renderWhatsAppPanel({
      ready: false,
      licenseRequired: true,
      message: "LICENSE_REQUIRED",
    });

    const connectButton = screen.getByRole("button", { name: "Connect WhatsApp" });
    expect((connectButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(connectButton);
    expect(mutationSpy).not.toHaveBeenCalled();

    const qrButton = screen.getByRole("button", { name: "QR" });
    expect((qrButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables WhatsApp QR onboarding after Evolution is ready", () => {
    renderWhatsAppPanel({ ready: true });

    expect((screen.getByRole("button", { name: "Connect WhatsApp" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "QR" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("opens a focused QR reconnect flow for an existing binding", async () => {
    mutationSpy.mockResolvedValue({
      data: {
        startWhatsAppQrOnboarding: {
          binding: { id: "wa-1", status: GQL.WhatsAppAccountStatus.PendingQr },
          qrBase64: "data:image/png;base64,abc",
        },
      },
    });
    renderWhatsAppPanel({ ready: true }, {
      reconnectBindingId: "wa-1",
      showAccountList: false,
    });

    expect(screen.getByText("Reconnect this WhatsApp account")).toBeTruthy();
    await waitFor(() => {
      expect(mutationSpy).toHaveBeenCalledWith({ variables: { input: { bindingId: "wa-1" } } });
    });
    expect(await screen.findByAltText("WhatsApp login QR code")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect WhatsApp" })).toBeNull();
  });

  it("refreshes WhatsApp accounts when the desktop reports QR connection completion", async () => {
    renderWhatsAppPanel({ ready: true });

    const handler = eventBusMock.subscribe.mock.calls.find(
      ([event]) => event === "affiliate-outreach-account-connected",
    )?.[1];
    expect(handler).toBeDefined();

    act(() => {
      handler?.({ channel: "WHATSAPP", accountId: "wa-1" });
    });

    expect(refetchSpy).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(toastMock.showToast).toHaveBeenCalledWith("WhatsApp account connected.", "success");
    });
  });

  it("disables Outlook OAuth onboarding while Microsoft Graph is not ready", () => {
    renderEmailPanel({
      ready: false,
      oauthConfigured: true,
      webhookConfigured: false,
      message: "Microsoft Graph webhook settings are not configured.",
    });

    const connectButton = screen.getByRole("button", { name: "Connect Outlook" });
    expect((connectButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(connectButton);
    expect(mutationSpy).not.toHaveBeenCalled();
  });

  it("enables Outlook OAuth onboarding after Microsoft Graph is ready", () => {
    renderEmailPanel({ ready: true });

    expect((screen.getByRole("button", { name: "Connect Outlook" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("refreshes Outlook accounts when the desktop reports OAuth completion", async () => {
    renderEmailPanel({ ready: true });

    const handler = eventBusMock.subscribe.mock.calls.find(
      ([event]) => event === "affiliate-outreach-account-connected",
    )?.[1];
    expect(handler).toBeDefined();

    act(() => {
      handler?.({ channel: "EMAIL", accountId: "email-1" });
    });

    expect(refetchSpy).toHaveBeenCalledTimes(2);
    await waitFor(() => {
      expect(toastMock.showToast).toHaveBeenCalledWith("Outlook mailbox connected.", "success");
    });
  });

  it("shows affiliate outreach operational health counters", () => {
    renderOpsPanel({});

    expect(screen.getByText("Direct sent: 9")).toBeTruthy();
    expect(screen.getByText("Direct inbound: 17")).toBeTruthy();
    expect(screen.getByText("Failed: 2")).toBeTruthy();
    expect(screen.getByText("Webhooks: 11")).toBeTruthy();
    expect(screen.getByText("Ignored webhooks: 1")).toBeTruthy();
    expect(screen.getByText("Rejected webhooks: 4")).toBeTruthy();
    expect(screen.getByText("Mailbox syncs: 7")).toBeTruthy();
    expect(screen.getByText("Sync failed: 1")).toBeTruthy();
    expect(screen.getByText("Renewals: 5")).toBeTruthy();
    expect(screen.getByText("Renewal failed: 2")).toBeTruthy();
    expect(screen.getByText("Active proxies: 6")).toBeTruthy();
    expect(screen.getByText("Proxy issues: 3")).toBeTruthy();
    expect(screen.getByText("Bad proxy bindings: 2")).toBeTruthy();
    expect(screen.getByText("Reconnect needed: 1")).toBeTruthy();
    expect(screen.getByText("Mailbox auth issues: 2")).toBeTruthy();
    expect(screen.getByText("Shared mailbox issues: 1")).toBeTruthy();
  });
});

type WhatsAppConnectorStatus = {
  configured: boolean;
  reachable: boolean;
  ready: boolean;
  httpStatus?: number | null;
  licenseRequired: boolean;
  message?: string | null;
  accountCounts: Array<{ status: GQL.WhatsAppAccountStatus; count: number }>;
  proxyCounts: Array<{ status: GQL.ProxyStatus; count: number }>;
};

type MicrosoftGraphConnectorStatus = {
  configured: boolean;
  oauthConfigured: boolean;
  webhookConfigured: boolean;
  ready: boolean;
  message?: string | null;
  accountCounts: Array<{ status: GQL.EmailAccountStatus; count: number }>;
  subscriptionCounts: Array<{ health: GQL.MicrosoftGraphSubscriptionHealth; count: number }>;
};

type AffiliateOutreachOperationalStatus = {
  since: string;
  failedDeliveryCount: number;
  webhookReceivedCount: number;
  ignoredWebhookCount: number;
  rejectedWebhookCount: number;
  mailboxSyncCount: number;
  failedMailboxSyncCount: number;
  subscriptionRenewalCount: number;
  failedSubscriptionRenewalCount: number;
  activeWhatsAppProxyCount: number;
  disabledWhatsAppProxyCount: number;
  errorWhatsAppProxyCount: number;
  whatsappAccountsUsingUnavailableProxyCount: number;
  whatsappAccountsNeedingReconnectCount: number;
  emailAccountsMissingRefreshTokenCount: number;
  sharedEmailAccountsMissingAddressCount: number;
  latestDeliveryAt?: string | null;
  latestInboundAt?: string | null;
  latestOperationalEventAt?: string | null;
  deliveryCounts: Array<{
    channel?: GQL.AffiliateMessageChannel | null;
    status: GQL.AffiliateDeliveryStatus;
    count: number;
  }>;
  inboundCounts: Array<{
    channel: GQL.AffiliateMessageChannel;
    direction: GQL.AffiliateCreatorMessageDirection;
    count: number;
  }>;
  operationalEventCounts: Array<{
    provider: GQL.AffiliateOutreachOperationalEventProvider;
    kind: GQL.AffiliateOutreachOperationalEventKind;
    status: GQL.AffiliateOutreachOperationalEventStatus;
    count: number;
  }>;
  operationalEventTypeCounts: Array<{
    provider: GQL.AffiliateOutreachOperationalEventProvider;
    kind: GQL.AffiliateOutreachOperationalEventKind;
    status: GQL.AffiliateOutreachOperationalEventStatus;
    eventType?: string | null;
    count: number;
  }>;
};
