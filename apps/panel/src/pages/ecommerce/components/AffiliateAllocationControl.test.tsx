// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AffiliateWorkspaceModel } from "@rivonclaw/core/models";
import i18n from "../../../i18n/index.js";
import { AffiliateAllocationControl } from "./AffiliateAllocationControl.js";

const mocks = vi.hoisted(() => ({
  assign: vi.fn(),
  toast: vi.fn(),
  candidates: {
    data: undefined as unknown,
    error: undefined as Error | undefined,
    loading: false,
  },
  candidateCalls: [] as Array<{ skip?: boolean; variables?: unknown }>,
}));
const workspace = AffiliateWorkspaceModel.create({});

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [mocks.assign, { loading: false }],
  useQuery: (_document: unknown, options: { skip?: boolean; variables?: unknown }) => {
    mocks.candidateCalls.push(options);
    return options.skip ? { data: undefined, error: undefined, loading: false } : mocks.candidates;
  },
}));
vi.mock("../../../components/Toast.js", () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock("../../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({ affiliateWorkspace: workspace }),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.candidateCalls.length = 0;
  mocks.candidates.data = {
    affiliateAssignableBusinessDevelopers: [
      { id: "bd-a", displayName: "Alice" },
      { id: "bd-b", displayName: "Bob" },
    ],
  };
  mocks.candidates.error = undefined;
  mocks.candidates.loading = false;
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

function view(owner: string | null = null, onChanged = vi.fn().mockResolvedValue(undefined)) {
  return render(
    <AffiliateAllocationControl
      creatorRelationshipId="relationship-1"
      businessDeveloperId={owner}
      onChanged={onChanged}
    />,
  );
}

it("offers Assign for a public-pool Creator and Change plus release for an owned one", () => {
  view(null);
  expect(screen.getByRole("button", { name: "Assign BD" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: i18n.t("ecommerce.affiliateWorkspace.releaseCreator") })).toBeNull();
  cleanup();
  view("bd-a");
  expect(screen.getByRole("button", { name: "Change BD" })).toBeTruthy();
  expect(screen.getByRole("button", { name: i18n.t("ecommerce.affiliateWorkspace.releaseCreator") })).toBeTruthy();
});

it("reads the assignable BDs only once the dialog opens, for this Creator", () => {
  view(null);
  expect(mocks.candidateCalls.every((call) => call.skip)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Assign BD" }));
  const last = mocks.candidateCalls.at(-1)!;
  expect(last.skip).toBe(false);
  expect(last.variables).toEqual({ creatorRelationshipId: "relationship-1" });
});

it("names the chosen BD explicitly, never a random assignment, and refreshes the caller", async () => {
  const onChanged = vi.fn().mockResolvedValue(undefined);
  view(null, onChanged);
  mocks.assign.mockResolvedValue({
    data: {
      assignAffiliateBusinessDeveloper: {
        id: "relationship-1",
        creatorId: "creator",
        businessDeveloperId: "bd-b",
        updatedAt: "2026-11-20T00:00:00Z",
      },
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Assign BD" }));
  fireEvent.click(screen.getByRole("button", { name: "Business developer" }));
  fireEvent.click(screen.getByText("Bob"));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
  });
  await waitFor(() => expect(mocks.assign).toHaveBeenCalledTimes(1));
  expect(mocks.assign.mock.calls[0]![0]).toEqual({
    variables: { input: { creatorRelationshipId: "relationship-1", businessDeveloperId: "bd-b" } },
  });
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  expect(mocks.toast).toHaveBeenCalledWith("Creator assigned to Bob.", "success");
});

it("does not list the current owner as a candidate", () => {
  view("bd-a");
  fireEvent.click(screen.getByRole("button", { name: "Change BD" }));
  fireEvent.click(screen.getByRole("button", { name: "Business developer" }));
  expect(screen.queryByText("Alice")).toBeNull();
  expect(screen.getByText("Bob")).toBeTruthy();
});

it("shows the refusal when the BD list cannot be read, and the empty state when no BD covers the shops", () => {
  view(null);
  mocks.candidates.error = new Error("outside your region");
  fireEvent.click(screen.getByRole("button", { name: "Assign BD" }));
  expect(screen.getByText("outside your region")).toBeTruthy();
  cleanup();
  mocks.candidates.error = undefined;
  mocks.candidates.data = { affiliateAssignableBusinessDevelopers: [] };
  view(null);
  fireEvent.click(screen.getByRole("button", { name: "Assign BD" }));
  expect(screen.getByText(i18n.t("ecommerce.affiliateStaff.allocateEmpty"))).toBeTruthy();
});

it("shows the translated Backend refusal and leaves everything unchanged when the assignment fails", async () => {
  const onChanged = vi.fn();
  view(null, onChanged);
  mocks.assign.mockRejectedValue(new Error(i18n.t("ecommerce.affiliateStaff.creatorOutsideRegionScope")));
  fireEvent.click(screen.getByRole("button", { name: "Assign BD" }));
  fireEvent.click(screen.getByRole("button", { name: "Business developer" }));
  fireEvent.click(screen.getByText("Alice"));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
  });
  await waitFor(() =>
    expect(mocks.toast).toHaveBeenCalledWith(
      i18n.t("ecommerce.affiliateStaff.creatorOutsideRegionScope"),
      "error",
    ),
  );
  expect(onChanged).not.toHaveBeenCalled();
});
