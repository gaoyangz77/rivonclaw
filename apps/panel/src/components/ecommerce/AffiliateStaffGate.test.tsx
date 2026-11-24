// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n/index.js";
import { useAffiliateAccess } from "../../hooks/useAffiliateAccess.js";
import { AffiliateStaffGate } from "./AffiliateStaffGate.js";

const state = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  query: { data: undefined, error: undefined, refetch: vi.fn() } as {
    data?: unknown;
    error?: Error;
    refetch: () => void;
  },
  skipped: [] as boolean[],
}));

vi.mock("../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({ currentUser: state.user }),
}));
vi.mock("@apollo/client/react", () => ({
  useQuery: (_document: unknown, options?: { skip?: boolean }) => {
    state.skipped.push(Boolean(options?.skip));
    return options?.skip ? { data: undefined, error: undefined, refetch: vi.fn() } : state.query;
  },
}));

const LEAD = { isOwner: false, permissionScopes: ["AFFILIATE_TEAM_LEAD"] };
const ADMIN = { isOwner: false, permissionScopes: ["AFFILIATE_REGION_ADMIN"] };
/** What the Backend says a login holds: each facet's permissions, or null when the facet is not held. */
const capabilities = (lead: string[] | null, admin: string[] | null) => ({
  data: {
    affiliateViewerCapabilities: {
      kind: "STAFF",
      isTeamLead: lead !== null,
      isRegionAdmin: admin !== null,
      teamLeadPermissions: lead ?? [],
      regionAdminPermissions: admin ?? [],
    },
  },
  error: undefined,
  refetch: vi.fn(),
});

function Probe() {
  const access = useAffiliateAccess();
  return (
    <p>{`view=${access.canView} operate=${access.canOperate} allocate=${access.canAllocate}`}</p>
  );
}

function renderGate(surface: "WORKBENCH" | "HISTORY" | "CREATORS" = "WORKBENCH") {
  render(
    <AffiliateStaffGate surface={surface}>
      <Probe />
    </AffiliateStaffGate>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  state.skipped.length = 0;
  state.query = { data: undefined, error: undefined, refetch: vi.fn() };
});
afterEach(cleanup);

describe("AffiliateStaffGate", () => {
  it.each([
    ["a supervisor", { isOwner: false, permissionScopes: ["AFFILIATE"] }],
    ["a BD", { isOwner: false, permissionScopes: ["AFFILIATE_BUSINESS_DEVELOPER"] }],
    ["an owner", { isOwner: true, permissionScopes: [] }],
  ])(
    "passes %s straight through without reading capabilities or restricting anything",
    (_name, user) => {
      state.user = user;
      renderGate();
      expect(screen.getByText("view=true operate=true allocate=false")).toBeTruthy();
      expect(state.skipped.every(Boolean)).toBe(true);
    },
  );

  it("holds a staff login on a loading state until the Backend names its profile", () => {
    state.user = LEAD;
    renderGate();
    expect(screen.getByText(i18n.t("ecommerce.affiliateStaff.loadingAccess"))).toBeTruthy();
    expect(screen.queryByText(/view=/)).toBeNull();
  });

  it("shows the failure with a retry that reads capabilities again", () => {
    state.user = LEAD;
    const refetch = vi.fn();
    state.query = { data: undefined, error: new Error("network down"), refetch };
    renderGate();
    expect(screen.getByText("network down")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("ecommerce.affiliateStaff.retry") }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("tells a login with the scope but no profile that it is not set up, and renders no page", () => {
    state.user = LEAD;
    state.query = capabilities(null, null);
    renderGate();
    expect(screen.getByText(i18n.t("ecommerce.affiliateStaff.notSetUpTitle"))).toBeTruthy();
    expect(screen.queryByText(/view=/)).toBeNull();
  });

  it("gives a team lead holding VIEW the workbench without operating or allocating", () => {
    state.user = LEAD;
    state.query = capabilities(["VIEW"], null);
    renderGate("WORKBENCH");
    expect(screen.getByText("view=true operate=false allocate=false")).toBeTruthy();
  });

  it("opens the workbenches and collaborations to a region admin holding VIEW", () => {
    state.user = ADMIN;
    state.query = capabilities(null, ["VIEW", "OPERATE", "ALLOCATE"]);
    for (const surface of ["WORKBENCH", "HISTORY", "CREATORS"] as const) {
      renderGate(surface);
      expect(screen.getByText("view=true operate=true allocate=true")).toBeTruthy();
      cleanup();
    }
  });

  it("gives a region admin without VIEW the Creator list with allocation, and closes the work views", () => {
    state.user = ADMIN;
    state.query = capabilities(null, ["ALLOCATE"]);
    renderGate("CREATORS");
    expect(screen.getByText("view=false operate=false allocate=true")).toBeTruthy();
    for (const surface of ["WORKBENCH", "HISTORY"] as const) {
      cleanup();
      renderGate(surface);
      expect(screen.getByText(i18n.t("ecommerce.affiliateStaff.unavailableTitle"))).toBeTruthy();
      expect(screen.queryByText(/view=/)).toBeNull();
    }
  });

  it("closes the work views to a team lead without VIEW too, since the role no longer decides", () => {
    state.user = LEAD;
    state.query = capabilities([], null);
    renderGate("WORKBENCH");
    expect(screen.getByText(i18n.t("ecommerce.affiliateStaff.unavailableTitle"))).toBeTruthy();
    cleanup();
    renderGate("CREATORS");
    expect(screen.getByText("view=false operate=false allocate=false")).toBeTruthy();
  });

  it("opens the work views when either facet of a two-profile login holds VIEW", () => {
    state.user = LEAD;
    state.query = capabilities(["ALLOCATE"], ["VIEW"]);
    renderGate("HISTORY");
    expect(screen.getByText("view=true operate=false allocate=true")).toBeTruthy();
  });
});
