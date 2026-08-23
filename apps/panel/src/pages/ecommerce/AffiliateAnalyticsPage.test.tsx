// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AffiliateAnalyticsPage } from "./AffiliateAnalyticsPage.js";

const mocks = vi.hoisted(() => ({
  entityStore: {} as Record<string, unknown>,
  overview: {} as Record<string, unknown>,
  dataQuery: vi.fn(),
  valuesQuery: vi.fn(),
}));

function operationName(document: { definitions?: Array<{ kind?: string; name?: { value?: string } }> }): string | undefined {
  return document.definitions?.find((definition) => definition.kind === "OperationDefinition")?.name?.value;
}

vi.mock("../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => mocks.entityStore,
}));

vi.mock("@apollo/client/react", () => ({
  useQuery: (document: Parameters<typeof operationName>[0]) => operationName(document) === "AffiliateAnalyticsOverview"
    ? mocks.overview
    : {
        loading: false,
        error: undefined,
        data: {
          getEcommerceBiCatalog: [
            {
              id: "AFFILIATE_PLATFORM_PERFORMANCE_DAILY",
              label: "Platform Performance",
              dimensions: [{ id: "DATE", label: "Date", filterable: true }],
              metrics: [
                { id: "AFFILIATE_NET_GMV_USD", label: "Net GMV USD" },
                { id: "AFFILIATE_ORDERS", label: "Orders" },
              ],
              groupingSets: [{ dimensions: [] }],
            },
            {
              id: "AFFILIATE_SAMPLE_CONVERSION_DAILY",
              label: "Sample Conversion",
              dimensions: [{ id: "DATE", label: "Date", filterable: true }],
              metrics: [
                { id: "AFFILIATE_APPLICATIONS_CREATED", label: "Applications" },
                { id: "AFFILIATE_CURRENTLY_APPROVED", label: "Approved" },
                { id: "AFFILIATE_SHIPPED_OBSERVED_CURRENT", label: "Shipped" },
                { id: "AFFILIATE_NET_GMV_USD", label: "Net GMV USD" },
              ],
              groupingSets: [{ dimensions: [] }],
            },
          ],
        },
      },
  useLazyQuery: (document: Parameters<typeof operationName>[0]) => operationName(document) === "AffiliateBiData"
    ? [mocks.dataQuery, { loading: false, error: undefined, data: undefined }]
    : [mocks.valuesQuery, { loading: false, error: undefined, data: undefined }],
}));

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: unknown }) => <div>{children as never}</div>;
  const Element = () => <span />;
  return {
    ResponsiveContainer: Container,
    LineChart: Container,
    BarChart: Container,
    CartesianGrid: Element,
    Legend: Element,
    Line: Element,
    Bar: Element,
    Tooltip: Element,
    XAxis: Element,
    YAxis: Element,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US" },
    t: (key: string, values?: { count?: number; date?: string }) => ({
      "ecommerce.affiliateAnalytics.title": "Affiliate Analytics",
      "ecommerce.affiliateAnalytics.overview": "Overview",
      "ecommerce.affiliateAnalytics.explore.title": "Explore",
      "ecommerce.affiliateAnalytics.platformTitle": "Platform performance",
      "ecommerce.affiliateAnalytics.sampleTitle": "Sample conversion",
      "ecommerce.affiliateAnalytics.nonAdditive": "These GMV contracts can overlap. Never add them into an Affiliate Total.",
      "ecommerce.affiliateAnalytics.run": "Run",
      "ecommerce.affiliateAnalytics.running": "Running…",
      "ecommerce.affiliateAnalytics.noEntitlementTitle": "Analytics access is not enabled",
      "ecommerce.affiliateAnalytics.region": "Shop region",
      "ecommerce.affiliateAnalytics.allRegions": "All regions",
      "ecommerce.affiliateAnalytics.customShopScope": "Custom shop scope",
      "ecommerce.affiliateAnalytics.selectedShops": `${values?.count ?? 0} shops selected`,
      "ecommerce.affiliateAnalytics.liveObserved": `Live observed ${values?.date ?? ""}`,
    }[key] ?? key.split(".").at(-1) ?? key),
  }),
}));

const totals = {
  grossGmvUsd: 0,
  netGmvUsd: 125,
  orders: 5,
  units: 7,
  estimatedCommissionUsd: 3,
  actualCommissionUsd: 2,
  targetCreatorsInvited: 10,
  targetSampleResponses: 4,
  targetResponseRate: 0.4,
  requestedTarget: 10,
  qualified: 8,
  sent: 6,
  replied: 4,
  failed: 1,
};

function overviewFixture() {
  return {
    scope: { shopIds: ["shop-1"], shopCount: 1, current: {}, comparison: {} },
    portfolio: { shops: 1, activeCampaigns: 2, activeTargetCollaborations: 3, activeOpenCollaborations: 4 },
    freshness: {
      platform: { asOf: "2026-08-23T12:00:00Z", stale: true, warnings: ["late"] },
      sample: { asOf: "2026-08-23T12:00:00Z", stale: false, warnings: [] },
      liveResponseObservedAt: "2026-08-23T12:30:00Z",
    },
    platform: { current: totals, comparison: { ...totals, netGmvUsd: 100 }, trend: [], comparisonTrend: [] },
    sample: {
      current: { ...totals, netGmvUsd: 75, applications: 12, approved: 6, rejected: 2, overdue: 1, inFlight: 2, completed: 3, shippedObserved: 4, contents: 5, approvalRate: 0.5, fulfillmentObservedRate: 2 / 3, completionRate: 0.5, statusBucketsExclusive: true },
      comparison: { ...totals, netGmvUsd: 50, applications: 10, approvalRate: 0.4, completionRate: 0.4 },
      trend: [],
      comparisonTrend: [],
    },
    campaignStages: [{ key: "sent", label: "Sent", value: 6 }],
    sampleStatuses: [{ key: "approved", label: "Approved", value: 6, share: 0.5 }],
    outreachMaturity: [{ horizon: "3h", responseRate: 0.25, matureInvitations: 8 }],
    outreachMaturityBasis: [{ basis: "SENT_AT", invitations: 8 }],
    sampleMaturity: [{ ageBucket: "0–1d", approvalRate: 0.5, fulfillmentObservedRate: 0.4, completionRate: 0.2 }],
    leaderboards: [{ entityType: "SHOP", platform: [], sample: [] }],
    health: { creatorIdentityRowCoverage: 0.98, creatorIdentityGmvCoverage: 0.99, exactApplicationTimeShare: 0.9, targetMappedApplicationShare: 0.8, campaignMappedApplicationShare: 0.7, warnings: [] },
  };
}

beforeEach(() => {
  mocks.entityStore = {
    currentUser: { id: "user-1" },
    shops: [{ id: "shop-1", shopName: "North Shop", alias: "North", region: "US" }],
    billingOverview: { shops: [{ shopId: "shop-1", analytics: { allowed: true } }] },
  };
  mocks.overview = {
    loading: false,
    error: undefined,
    networkStatus: 7,
    refetch: vi.fn(),
    data: { getAffiliateAnalyticsOverview: overviewFixture() },
  };
  mocks.dataQuery.mockReset();
  mocks.valuesQuery.mockReset();
  mocks.dataQuery.mockResolvedValue({
    data: {
      getEcommerceBiData: {
        datasetId: "AFFILIATE_PLATFORM_PERFORMANCE_DAILY",
        granularity: "DAILY",
        totalCount: 1,
        rows: [{ DATE: "2026-08-23", AFFILIATE_NET_GMV_USD: 125, AFFILIATE_ORDERS: 5 }],
        columns: [
          { key: "DATE", label: "Date", dimension: "DATE", metric: null },
          { key: "AFFILIATE_NET_GMV_USD", label: "Net GMV USD", dimension: null, metric: "AFFILIATE_NET_GMV_USD" },
          { key: "AFFILIATE_ORDERS", label: "Orders", dimension: null, metric: "AFFILIATE_ORDERS" },
        ],
        pageInfo: { hasMore: false },
        freshness: { asOf: "2026-08-23T12:00:00Z", stale: false, warnings: [] },
      },
    },
  });
});

afterEach(cleanup);

describe("AffiliateAnalyticsPage", () => {
  it("shows parallel Overview contracts, stale state and the permanent non-additive warning", () => {
    render(<AffiliateAnalyticsPage />);

    expect(screen.getByRole("heading", { name: "Affiliate Analytics" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Platform performance" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Sample conversion" })).toBeTruthy();
    expect(screen.getByText(/Never add them into an Affiliate Total/)).toBeTruthy();
    expect(screen.getByText("stale")).toBeTruthy();
  });

  it("does not query Explore until Run and resets to Sample metrics on contract switch", async () => {
    render(<AffiliateAnalyticsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Explore" }));

    expect(mocks.dataQuery).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sample conversion" }));
    expect(screen.getAllByText("Applications").length).toBeGreaterThan(0);
    expect(mocks.dataQuery).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(mocks.dataQuery).toHaveBeenCalledTimes(1));
  });

  it("keeps the selected Region visible after resolving its authorized Shop scope", () => {
    mocks.entityStore = {
      ...mocks.entityStore,
      shops: [
        { id: "shop-1", shopName: "North Shop", alias: "North", region: "US" },
        { id: "shop-2", shopName: "Berlin Shop", alias: "Berlin", region: "DE" },
      ],
      billingOverview: {
        shops: [
          { shopId: "shop-1", analytics: { allowed: true } },
          { shopId: "shop-2", analytics: { allowed: true } },
        ],
      },
    };
    render(<AffiliateAnalyticsPage />);

    const region = screen.getByLabelText("Shop region") as HTMLSelectElement;
    fireEvent.change(region, { target: { value: "DE" } });

    expect(region.value).toBe("DE");
    expect(screen.getByText("1 shops selected")).toBeTruthy();
  });

  it("shows the entitlement state without leaking an analytics query", () => {
    mocks.entityStore = {
      ...mocks.entityStore,
      billingOverview: { shops: [{ shopId: "shop-1", analytics: { allowed: false } }] },
    };
    render(<AffiliateAnalyticsPage />);
    expect(screen.getByText("Analytics access is not enabled")).toBeTruthy();
  });
});
