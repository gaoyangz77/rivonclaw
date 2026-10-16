import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "../../../i18n/index.js";
import { AffiliateClaimCreatorButton } from "./AffiliateClaimCreatorButton.js";
import { AffiliateWorkspaceModel } from "@rivonclaw/core/models";

const workspace = AffiliateWorkspaceModel.create({});
vi.mock("../../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({ affiliateWorkspace: workspace }),
}));

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  toast: vi.fn(),
  loading: false,
}));
vi.mock("@apollo/client/react", () => ({
  useMutation: () => [mocks.claim, { loading: mocks.loading }],
}));
vi.mock("../../../components/Toast.js", () => ({ useToast: () => ({ showToast: mocks.toast }) }));
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.loading = false;
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

it("sends only the Relationship ID and refreshes ownership after a successful claim", async () => {
  const relationship = {
    id: "relationship",
    creatorId: "creator",
    businessDeveloperId: "my-bd",
    operationalConfigRevision: 5,
    updatedAt: "2026-10-16T12:00:00Z",
  };
  mocks.claim.mockResolvedValue({ data: { claimAffiliateCreatorRelationship: relationship } });
  const claimed = vi.fn().mockResolvedValue(undefined);
  render(<AffiliateClaimCreatorButton creatorRelationshipId="relationship" onClaimed={claimed} />);
  fireEvent.click(screen.getByRole("button", { name: "认领给我" }));
  await waitFor(() => expect(claimed).toHaveBeenCalledWith("my-bd"));
  expect(mocks.claim).toHaveBeenCalledWith({
    variables: { creatorRelationshipId: "relationship" },
  });
  expect(mocks.toast).toHaveBeenCalledWith("已认领，后续由你负责。", "success");
  expect(workspace.getCreatorRelationship("relationship")?.businessDeveloperId).toBe("my-bd");
});

it("disables repeat clicks while the request is pending", () => {
  mocks.loading = true;
  render(<AffiliateClaimCreatorButton creatorRelationshipId="relationship" onClaimed={vi.fn()} />);
  const button = screen.getByRole("button", { name: "认领给我" });
  expect(button.hasAttribute("disabled")).toBe(true);
  fireEvent.click(button);
  expect(mocks.claim).not.toHaveBeenCalled();
});

it("does not change UI ownership when a different BD wins the claim", async () => {
  mocks.claim.mockRejectedValue(new Error("Already assigned"));
  const claimed = vi.fn();
  render(<AffiliateClaimCreatorButton creatorRelationshipId="relationship" onClaimed={claimed} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "认领给我" })));
  expect(mocks.toast).toHaveBeenCalledWith("Already assigned", "error");
  expect(claimed).not.toHaveBeenCalled();
});

it.each(["en", "zh", "de", "es", "fr", "id", "it", "th"])(
  "has complete claim translations in %s",
  (language) => {
    for (const key of ["claimCreator", "claimCreatorHint", "creatorClaimed"])
      expect(i18n.exists(`ecommerce.affiliateWorkspace.${key}`, { lng: language })).toBe(true);
  },
);
