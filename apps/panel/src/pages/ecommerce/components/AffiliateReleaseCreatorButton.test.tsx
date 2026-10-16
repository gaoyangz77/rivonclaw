import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AffiliateWorkspaceModel } from "@rivonclaw/core/models";
import i18n from "../../../i18n/index.js";
import { AffiliateReleaseCreatorButton } from "./AffiliateReleaseCreatorButton.js";

const mocks = vi.hoisted(() => ({ release: vi.fn(), toast: vi.fn(), loading: false }));
const workspace = AffiliateWorkspaceModel.create({});
vi.mock("@apollo/client/react", () => ({
  useMutation: () => [mocks.release, { loading: mocks.loading }],
}));
vi.mock("../../../components/Toast.js", () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock("../../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({ affiliateWorkspace: workspace }),
}));
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.loading = false;
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);
function view(owner = "bd-a", onReleased = vi.fn().mockResolvedValue(undefined)) {
  return (
    <AffiliateReleaseCreatorButton
      creatorRelationshipId="relationship"
      businessDeveloperId={owner}
      onReleased={onReleased}
    />
  );
}
it("warns before any mutation; cancel leaves everything unchanged", () => {
  render(view());
  fireEvent.click(screen.getByRole("button", { name: "退回公池" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText(/WhatsApp、邮箱/).textContent).toContain(
    "已添加的社媒账号及现有会话不会随解绑自动迁移",
  );
  expect(mocks.release).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(mocks.release).not.toHaveBeenCalled();
});
it("freezes the confirmed owner, hydrates an empty MST store and refreshes on success", async () => {
  const onReleased = vi.fn().mockResolvedValue(undefined);
  const rendered = render(view("bd-a", onReleased));
  fireEvent.click(screen.getByRole("button", { name: "退回公池" }));
  rendered.rerender(view("bd-b", onReleased));
  mocks.release.mockResolvedValue({
    data: {
      releaseAffiliateCreatorRelationship: {
        id: "relationship",
        creatorId: "creator",
        businessDeveloperId: null,
        operationalConfigRevision: 7,
        activeRunId: "preserved",
        updatedAt: "2026-10-16T12:00:00Z",
      },
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认解绑" }));
  await waitFor(() => expect(onReleased).toHaveBeenCalledOnce());
  expect(mocks.release).toHaveBeenCalledWith({
    variables: { creatorRelationshipId: "relationship", expectedBusinessDeveloperId: "bd-a" },
  });
  expect(workspace.getCreatorRelationship("relationship")?.businessDeveloperId).toBeNull();
  expect(workspace.getCreatorRelationship("relationship")?.activeRunId).toBe("preserved");
});
it("does not show success or reset ownership on a stale-owner failure", async () => {
  mocks.release.mockRejectedValue(new Error("Owner changed"));
  const onReleased = vi.fn();
  render(view("bd-a", onReleased));
  fireEvent.click(screen.getByRole("button", { name: "退回公池" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "确认解绑" })));
  expect(onReleased).not.toHaveBeenCalled();
  expect(mocks.toast).toHaveBeenCalledWith("Owner changed", "error");
});
it.each(["en", "zh", "de", "es", "fr", "id", "it", "th"])(
  "has translated release strings in %s",
  (language) => {
    for (const key of [
      "releaseCreator",
      "confirmReleaseCreator",
      "releaseCreatorWarning",
      "creatorReleased",
    ])
      expect(i18n.exists(`ecommerce.affiliateWorkspace.${key}`, { lng: language })).toBe(true);
  },
);
