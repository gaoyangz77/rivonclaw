// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AffiliateAnalyticsPage } from "./AffiliateAnalyticsPage.js";

const mocks = vi.hoisted(() => ({
  entityStore: {} as Record<string, unknown>,
  sections: {} as Record<string, Record<string, unknown>>,
  queryCalls: [] as Array<{ operation?: string; variables?: Record<string, unknown> }>,
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
  useQuery: (document: Parameters<typeof operationName>[0], options?: { variables?: Record<string, unknown> }) => {
    const operation = operationName(document);
    mocks.queryCalls.push({ operation, variables: options?.variables });
    if (operation && operation in mocks.sections) return mocks.sections[operation];
    return {
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
    };
  },
  useLazyQuery: (document: Parameters<typeof operationName>[0]) => operationName(document) === "AffiliateBiData"
    ? [mocks.dataQuery, { loading: false, error: undefined, data: undefined }]
    : [mocks.valuesQuery, { loading: false, error: undefined, data: undefined }],
}));

/**
 * Chart roots record which data array they were handed, because a truncated
 * series is invisible in the DOM otherwise: the assertions that matter here are
 * about which ROWS reached the chart, not about pixels.
 */
vi.mock("recharts", () => {
  const Container = ({ children }: { children?: unknown }) => <div>{children as never}</div>;
  const Element = () => <span />;
  const chart = (kind: string) => ({ children, data }: { children?: unknown; data?: unknown[] }) => (
    <div data-chart={kind} data-rows={String(data?.length ?? 0)}>{children as never}</div>
  );
  return {
    ResponsiveContainer: Container,
    LineChart: chart("line"),
    BarChart: chart("bar"),
    ComposedChart: chart("composed"),
    AreaChart: chart("area"),
    Area: Element,
    CartesianGrid: Element,
    Cell: Element,
    Legend: Element,
    Line: Element,
    ReferenceArea: Element,
    Bar: Element,
    Tooltip: Element,
    XAxis: Element,
    YAxis: Element,
  };
});

/**
 * Keys not in this dictionary resolve to the key itself, which is exactly what
 * `affiliateCatalogLabel` relies on to fall back to the server-sent label.
 */
const COPY: Record<string, string> = {
  "ecommerce.affiliateAnalytics.title": "Affiliate Analytics",
  "ecommerce.affiliateAnalytics.overview": "Overview",
  "ecommerce.affiliateAnalytics.explore.title": "Explore",
  "ecommerce.affiliateAnalytics.platformTitle": "Platform performance",
  "ecommerce.affiliateAnalytics.sampleTitle": "Sample conversion",
  "ecommerce.affiliateAnalytics.run": "Run",
  "ecommerce.affiliateAnalytics.noEntitlementTitle": "Analytics access is not enabled",
  "ecommerce.affiliateAnalytics.region": "Shop region",
  "ecommerce.affiliateAnalytics.allRegions": "All regions",
  "ecommerce.affiliateAnalytics.window": "Cohort window",
  "ecommerce.affiliateAnalytics.portfolio.caption": "Current values · unaffected by the window",
  "ecommerce.affiliateAnalytics.portfolio.campaigns": "Active campaigns",
  "ecommerce.affiliateAnalytics.portfolio.target": "Active TARGET",
  "ecommerce.affiliateAnalytics.portfolio.open": "Active OPEN",
  "ecommerce.affiliateAnalytics.sectionUnavailableTitle": "This section is unavailable",
  "ecommerce.affiliateAnalytics.reachout.title": "Reachout",
  "ecommerce.affiliateAnalytics.reachout.axis": "Cohort axis: the real invitation date",
  "ecommerce.affiliateAnalytics.reachout.cohortResponseRate": "Cohort response rate",
  "ecommerce.affiliateAnalytics.reachout.exactShare": "Exact share",
  "ecommerce.affiliateAnalytics.approval.title": "Sample approval",
  "ecommerce.affiliateAnalytics.approval.axis": "Cohort axis: the application submission date",
  "ecommerce.affiliateAnalytics.approval.overdueRate": "Overdue rate",
  "ecommerce.affiliateAnalytics.postApproval.title": "Post-approval performance",
  "ecommerce.affiliateAnalytics.postApproval.axis": "Cohort axis: the application date · measured in units",
  "ecommerce.affiliateAnalytics.postApproval.actualUnits": "Units to date",
  "ecommerce.affiliateAnalytics.explore.operators.IN": "Is one of",
  "ecommerce.affiliateAnalytics.explore.directions.DESC": "Descending",
  "ecommerce.affiliateAnalytics.catalog.dimensions.DATE": "Date",
  "ecommerce.affiliateAnalytics.catalog.metrics.AFFILIATE_APPLICATIONS_CREATED": "Applications",
  "ecommerce.affiliateAnalytics.coverage.boundary": "Series start on {{date}} · {{shops}} shops with data",
  "ecommerce.affiliateAnalytics.coverage.partialDays": "{{count}} earlier partial days",
  "ecommerce.affiliateAnalytics.coverage.showPartial": "Show the partial range anyway",
  "ecommerce.affiliateAnalytics.coverage.hidePartial": "Hide the partial range",
  "ecommerce.affiliateAnalytics.coverage.excludeLimiting": "Exclude the {{count}} latest-starting shops",
  "ecommerce.affiliateAnalytics.coverage.limitingShops": "Latest to start: {{shops}}",
  "ecommerce.affiliateAnalytics.coverage.noneTitle": "No selected shop has data for this section",
  "ecommerce.affiliateAnalytics.coverage.metricBasis": "Computed over {{shops}} of {{selected}} shops · fully covered from {{date}}",
  "ecommerce.affiliateAnalytics.coverage.bandCaption": "Data coverage over {{count}} shops",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US" },
    t: (key: string, values?: Record<string, unknown>) => {
      const copy = COPY[key];
      if (copy) return copy.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(values?.[name] ?? ""));
      if (key === "ecommerce.affiliateAnalytics.windowDays") return `Last ${values?.count}d`;
      if (key === "ecommerce.affiliateAnalytics.selectedShops") return `${values?.count ?? 0} shops selected`;
      return key;
    },
  }),
}));

function sectionResult(field: string, value: unknown) {
  return {
    loading: false,
    error: undefined,
    networkStatus: 7,
    refetch: vi.fn(),
    data: { [field]: value },
  };
}

/**
 * A boundary with real spread: `shop-1` starts on 2026-06-01 and `shop-2` only
 * on 2026-08-19, so every day between them was measured over one shop rather
 * than two. `shop-3` has no data at all and must not become the boundary.
 */
function coverageFixture(days: string[]) {
  return {
    fullCoverageFrom: "2026-08-19",
    shopsSelected: 3,
    limitingShops: [{ shopId: "shop-2", shopName: "Berlin Shop", coverageFrom: "2026-08-19" }],
    shops: [
      { shopId: "shop-1", shopName: "North Shop", coverageFrom: "2026-06-01" },
      { shopId: "shop-2", shopName: "Berlin Shop", coverageFrom: "2026-08-19" },
      { shopId: "shop-3", shopName: "Quiet Shop", coverageFrom: null },
    ],
    daily: days.map((ds) => ({ ds, shopsWithData: ds >= "2026-08-19" ? 2 : 1 })),
  };
}

function reachoutFixture() {
  return {
    invitations: 1_178_913,
    responded: 1_353,
    cohortResponseRate: 0.001148,
    immatureShare: 0.24,
    responsesExact: 92,
    responsesProxy: 8,
    horizons: [
      { horizon: "3h", matureInvitations: 620_000, responsesWithinHorizon: 210, responseRate: 0.00034 },
      { horizon: "72h", matureInvitations: 540_000, responsesWithinHorizon: 749, responseRate: 0.00139 },
      { horizon: "7d", matureInvitations: 480_000, responsesWithinHorizon: 627, responseRate: 0.00131 },
    ],
    daily: [
      { inviteDs: "2026-06-01", invitations: 800, responded: 9, mature: true },
      { inviteDs: "2026-08-20", invitations: 640, responded: 1, mature: false },
    ],
    coverage: coverageFixture(["2026-06-01", "2026-08-20"]),
  };
}

function approvalFixture() {
  return {
    applications: 420,
    approved: 300,
    merchantRejected: 60,
    overdueByUs: 20,
    inFlight: 40,
    approvalRate: 0.714,
    merchantRejectRate: 0.143,
    overdueRate: 0.048,
    daily: [{ cohortDs: "2026-08-01", applications: 40, approved: 30, merchantRejected: 5, overdueByUs: 2, inFlight: 3 }],
    byAge: [{ ageBucket: "0–1d", applications: 40, approved: 20, merchantRejected: 4, overdueByUs: 1, inFlight: 15 }],
    coverage: coverageFixture(["2026-08-01"]),
  };
}

function postApprovalFixture() {
  return {
    approvedApplications: 300,
    applicationsWithOrder: 96,
    orderRate: 0.32,
    actualUnits: 812,
    projectedUnits: 954.4,
    unitsPerApprovedActual: 2.71,
    unitsPerApprovedProjected: 3.18,
    cohorts: [
      { cohortDs: "2026-06-01", approvedApplications: 40, actualUnits: 120, projectedRemainingUnits: 0, completionFactor: 1, ageDays: 84 },
      { cohortDs: "2026-08-18", approvedApplications: 30, actualUnits: 22, projectedRemainingUnits: 41.5, completionFactor: 0.35, ageDays: 6 },
    ],
    maturationCurve: [
      { lagDays: 0, cumulativeShare: 0.04, basisCohorts: 41 },
      { lagDays: 30, cumulativeShare: 0.78, basisCohorts: 41 },
    ],
    coverage: coverageFixture(["2026-06-01", "2026-08-18"]),
  };
}

beforeEach(() => {
  mocks.entityStore = {
    currentUser: { id: "user-1" },
    shops: [{ id: "shop-1", shopName: "North Shop", alias: "North", region: "US" }],
    billingOverview: { shops: [{ shopId: "shop-1", analytics: { allowed: true } }] },
  };
  mocks.sections = {
    AffiliateOverviewReachout: sectionResult("getAffiliateOverviewReachout", reachoutFixture()),
    AffiliateOverviewApproval: sectionResult("getAffiliateOverviewApproval", approvalFixture()),
    AffiliateOverviewPostApproval: sectionResult("getAffiliateOverviewPostApproval", postApprovalFixture()),
    AffiliateOverviewPortfolio: sectionResult("getAffiliateAnalyticsOverviewCore", {
      portfolio: { activeCampaigns: 7, activeTargetCollaborations: 11, activeOpenCollaborations: 3 },
    }),
  };
  mocks.queryCalls = [];
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

function overviewInputs(): Array<{ shopIds?: string[]; windowDays?: number }> {
  return mocks.queryCalls
    .filter((call) => call.operation === "AffiliateOverviewReachout")
    .map((call) => call.variables?.input as { shopIds?: string[]; windowDays?: number });
}

function portfolioInputs(): Array<Record<string, unknown>> {
  return mocks.queryCalls
    .filter((call) => call.operation === "AffiliateOverviewPortfolio")
    .map((call) => call.variables?.input as Record<string, unknown>);
}

describe("AffiliateAnalyticsPage Overview", () => {
  it("renders the three cohort sections, each declaring its own time axis", () => {
    render(<AffiliateAnalyticsPage />);

    expect(screen.getByRole("heading", { level: 2, name: "Reachout" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Sample approval" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Post-approval performance" })).toBeTruthy();
    expect(screen.getByText("Cohort axis: the real invitation date")).toBeTruthy();
    expect(screen.getByText("Cohort axis: the application submission date")).toBeTruthy();
    expect(screen.getByText("Cohort axis: the application date · measured in units")).toBeTruthy();
  });

  it("opens on the 30 day window and re-queries when another window is chosen", () => {
    render(<AffiliateAnalyticsPage />);

    expect(overviewInputs().at(0)).toEqual({ shopIds: ["shop-1"], windowDays: 30 });

    fireEvent.click(screen.getByRole("button", { name: "Last 90d" }));

    expect(overviewInputs().some((input) => input.windowDays === 90)).toBe(true);
  });

  it("labels the portfolio counts as current values that the window does not move", () => {
    render(<AffiliateAnalyticsPage />);

    expect(screen.getByText("Current values · unaffected by the window")).toBeTruthy();
    for (const [label, value] of [["Active campaigns", "7"], ["Active TARGET", "11"], ["Active OPEN", "3"]]) {
      expect(screen.getByText(label).parentElement?.textContent).toContain(value);
    }
  });

  it("never varies the portfolio query with the cohort window", () => {
    render(<AffiliateAnalyticsPage />);
    const before = portfolioInputs().at(0);

    fireEvent.click(screen.getByRole("button", { name: "Last 60d" }));

    expect(before).toBeDefined();
    for (const input of portfolioInputs()) expect(input).toEqual(before);
    expect(Object.keys(before!)).not.toContain("windowDays");
  });

  it("drops the comparison selector and the free date range from the Overview controls", () => {
    const { container } = render(<AffiliateAnalyticsPage />);

    expect(container.querySelector(".affiliate-overview input[type=\"date\"]")).toBeNull();
    expect(screen.queryByText("ecommerce.affiliateAnalytics.comparison")).toBeNull();
  });

  it("uses no native select in the Overview controls", () => {
    const { container } = render(<AffiliateAnalyticsPage />);

    expect(container.querySelectorAll(".affiliate-overview select")).toHaveLength(0);
  });

  it("renders a sub-percent cohort response rate with real precision", () => {
    render(<AffiliateAnalyticsPage />);

    const metric = screen.getByText("Cohort response rate").parentElement;
    expect(metric?.textContent).toContain("0.115%");
  });

  it("keeps the other sections readable when one section comes back absent", () => {
    mocks.sections = {
      ...mocks.sections,
      AffiliateOverviewPostApproval: sectionResult("getAffiliateOverviewPostApproval", null),
    };
    render(<AffiliateAnalyticsPage />);

    expect(screen.getByText("This section is unavailable")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Reachout" })).toBeTruthy();
    expect(screen.queryByText("Units to date")).toBeNull();
  });

  it("shows the entitlement state without leaking an analytics query", () => {
    mocks.entityStore = {
      ...mocks.entityStore,
      billingOverview: { shops: [{ shopId: "shop-1", analytics: { allowed: false } }] },
    };
    render(<AffiliateAnalyticsPage />);

    expect(screen.getByText("Analytics access is not enabled")).toBeTruthy();
    expect(mocks.queryCalls.some((call) => call.operation?.startsWith("AffiliateOverview"))).toBe(false);
  });

  it("narrows the queried shop scope to the chosen region", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Shop region" }));
    fireEvent.click(await screen.findByRole("button", { name: "DE" }));

    await waitFor(() => expect(overviewInputs().some((input) => input.shopIds?.length === 1 && input.shopIds[0] === "shop-2")).toBe(true));
    expect(screen.getByText("1 shops selected")).toBeTruthy();
  });
});


describe("AffiliateAnalyticsPage Overview data coverage", () => {
  function section(container: HTMLElement, id: string): HTMLElement {
    return container.querySelector(`[data-tutorial-id="affiliate-analytics-${id}"]`) as HTMLElement;
  }

  function chartRows(scope: HTMLElement, kind: string): number[] {
    return [...scope.querySelectorAll(`[data-chart="${kind}"]`)]
      .map((node) => Number(node.getAttribute("data-rows")));
  }

  it("states the boundary and names the shops that set it", () => {
    const { container } = render(<AffiliateAnalyticsPage />);
    const reachout = section(container, "reachout");

    expect(within(reachout).getByText("Series start on Aug 19 · 2 shops with data")).toBeTruthy();
    expect(within(reachout).getByText("Latest to start: Berlin Shop")).toBeTruthy();
  });

  it("plots only the fully-covered days by default, while the band keeps the whole span", () => {
    const { container } = render(<AffiliateAnalyticsPage />);
    const reachout = section(container, "reachout");

    // The daily fixture holds 2026-06-01 and 2026-08-20; only the second is at
    // or after the 2026-08-19 boundary.
    expect(chartRows(reachout, "composed")).toEqual([1]);
    // The band still covers both days, so the reader sees that earlier data
    // exists and is partial rather than absent.
    expect(chartRows(reachout, "area")).toEqual([2]);
  });

  it("restores the partial range only when the reader asks for it", () => {
    const { container } = render(<AffiliateAnalyticsPage />);
    const reachout = section(container, "reachout");

    fireEvent.click(within(reachout).getByRole("button", { name: "Show the partial range anyway" }));

    expect(chartRows(reachout, "composed")).toEqual([2]);
    expect(within(reachout).getByRole("button", { name: "Hide the partial range" })).toBeTruthy();
  });

  it("truncates the other two sections on their own boundaries", () => {
    const { container } = render(<AffiliateAnalyticsPage />);

    // The approval cohort day 2026-08-01 precedes the boundary, so its daily
    // chart truncates to nothing while the age chart, which has no date axis,
    // keeps its bucket.
    expect(chartRows(section(container, "approval"), "bar")).toEqual([0, 1]);
    expect(chartRows(section(container, "post-approval"), "bar")).toEqual([0]);
  });

  it("discloses the shop basis next to the rate it was computed over", () => {
    const { container } = render(<AffiliateAnalyticsPage />);

    expect(within(section(container, "reachout"))
      .getByText("Computed over 2 of 3 shops · fully covered from Aug 19")).toBeTruthy();
  });

  it("narrows the page shop scope when the limiting shops are excluded", async () => {
    mocks.entityStore = {
      ...mocks.entityStore,
      shops: [
        { id: "shop-1", shopName: "North Shop", alias: "North", region: "US" },
        { id: "shop-2", shopName: "Berlin Shop", alias: "Berlin", region: "DE" },
        { id: "shop-3", shopName: "Quiet Shop", alias: "Quiet", region: "US" },
      ],
      billingOverview: {
        shops: [
          { shopId: "shop-1", analytics: { allowed: true } },
          { shopId: "shop-2", analytics: { allowed: true } },
          { shopId: "shop-3", analytics: { allowed: true } },
        ],
      },
    };
    const { container } = render(<AffiliateAnalyticsPage />);
    expect(overviewInputs().at(0)?.shopIds).toEqual(["shop-1", "shop-2", "shop-3"]);

    fireEvent.click(within(section(container, "reachout"))
      .getByRole("button", { name: "Exclude the 1 latest-starting shops" }));

    await waitFor(() => expect(overviewInputs().at(-1)?.shopIds).toEqual(["shop-1", "shop-3"]));
  });

  it("says so plainly when no selected shop has data, instead of drawing an empty window", () => {
    mocks.sections = {
      ...mocks.sections,
      AffiliateOverviewReachout: sectionResult("getAffiliateOverviewReachout", {
        ...reachoutFixture(),
        coverage: {
          fullCoverageFrom: null,
          shopsSelected: 3,
          limitingShops: [],
          shops: [{ shopId: "shop-1", shopName: "North Shop", coverageFrom: null }],
          daily: [],
        },
      }),
    };
    const { container } = render(<AffiliateAnalyticsPage />);
    const reachout = section(container, "reachout");

    expect(within(reachout).getByText("No selected shop has data for this section")).toBeTruthy();
    // Nothing is covered, so nothing is truncated: the reader still sees the
    // rows that exist rather than a blank chart.
    expect(chartRows(reachout, "composed")).toEqual([2]);
    expect(chartRows(reachout, "area")).toEqual([]);
  });
});

describe("AffiliateAnalyticsPage Explore", () => {
  it("does not query until Run and resets to Sample metrics on contract switch", async () => {
    render(<AffiliateAnalyticsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Explore" }));

    expect(mocks.dataQuery).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sample conversion" }));
    expect(screen.getAllByText("Applications").length).toBeGreaterThan(0);
    expect(mocks.dataQuery).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(mocks.dataQuery).toHaveBeenCalledTimes(1));
  });

  it("localizes the filter operator and sort direction instead of showing raw codes", () => {
    const { container } = render(<AffiliateAnalyticsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Explore" }));

    const explore = container.querySelector(".affiliate-explore")!;
    expect(within(explore as HTMLElement).getByText("Is one of")).toBeTruthy();
    expect(within(explore as HTMLElement).getByText("Descending")).toBeTruthy();
    expect(within(explore as HTMLElement).queryByText("NOT IN")).toBeNull();
    expect(explore.querySelectorAll("select")).toHaveLength(0);
  });
});
