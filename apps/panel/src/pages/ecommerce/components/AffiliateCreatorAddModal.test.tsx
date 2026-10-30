// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import { IMPORT_AFFILIATE_CREATOR_UPDATES_MUTATION } from "../../../api/shops-queries.js";
import {
  AffiliateCreatorAddModal,
  buildAffiliateCreatorAddEntry,
  normalizeCreatorUsername,
} from "./AffiliateCreatorAddModal.js";

const BATCH_ID = "batch-1";
const TAGS = [
  { id: "tag-1", name: "VIP" },
  { id: "tag-2", name: "Beauty" },
  { id: "tag-3", name: "Vip-lite" },
];
const DEVELOPERS = [
  { id: "bd-1", displayName: "Maria" },
  { id: "bd-2", displayName: "Chen" },
];

type Variables = { input: GQL.ImportAffiliateCreatorUpdatesInput };

function payload(status: GQL.AffiliateCreatorBulkUpdateStatus, reason: string | null = null) {
  return {
    __typename: "ImportAffiliateCreatorUpdatesPayload",
    appliedCount: status === GQL.AffiliateCreatorBulkUpdateStatus.Applied ? 1 : 0,
    noOpCount: status === GQL.AffiliateCreatorBulkUpdateStatus.NoOp ? 1 : 0,
    rejectedCount: status === GQL.AffiliateCreatorBulkUpdateStatus.Rejected ? 1 : 0,
    failedCount: status === GQL.AffiliateCreatorBulkUpdateStatus.Failed ? 1 : 0,
    protectionsChanged: 0,
    businessDevelopersChanged: 0,
    manualTagAssignmentsAdded: 0,
    results: [
      {
        __typename: "AffiliateCreatorBulkUpdateItemResult",
        index: 0,
        status,
        reason,
        protectionChanged: false,
        businessDeveloperChanged: false,
        sellerMetadataChanged: false,
        addedManualTagNames: [],
      },
    ],
  };
}

function setup(
  outcome: { data: ReturnType<typeof payload> } | { error: Error },
  catalog: { tags?: typeof TAGS; tagsLoading?: boolean } = {},
) {
  const sent: Variables[] = [];
  const onClose = vi.fn();
  const onAdded = vi.fn();
  const mock = {
    request: {
      query: IMPORT_AFFILIATE_CREATOR_UPDATES_MUTATION,
      variables: (variables: Variables) => {
        sent.push(variables);
        return true;
      },
    },
    ...("error" in outcome
      ? { error: outcome.error }
      : { result: { data: { importAffiliateCreatorUpdates: outcome.data } } }),
  };
  render(
    <MockedProvider mocks={[mock as never]}>
      <ToastProvider>
        <AffiliateCreatorAddModal
          isOpen
          onClose={onClose}
          developers={DEVELOPERS}
          tags={catalog.tags ?? TAGS}
          tagsLoading={catalog.tagsLoading ?? false}
          onAdded={onAdded}
        />
      </ToastProvider>
    </MockedProvider>,
  );
  return { sent, onClose, onAdded };
}

const usernameInput = () => screen.getByLabelText("TikTok username") as HTMLInputElement;
const protectBox = () => screen.getByRole("checkbox", { name: /Protect/ }) as HTMLInputElement;
const noteInput = () => screen.getByLabelText("Protection note") as HTMLInputElement;
const submitButton = () => screen.getByRole("button", { name: "Add Creator" }) as HTMLButtonElement;

const uidInput = () => screen.getByLabelText("UID note") as HTMLInputElement;
const creatorNoteInput = () => screen.getByLabelText("Seller note") as HTMLTextAreaElement;
const tagSearchInput = () => screen.getByLabelText("Search tags") as HTMLInputElement;
const tagOption = (name: string) => screen.getByRole("button", { name, pressed: false });
const NOTHING_TO_APPLY =
  "Without protection, fill in at least one of: responsible BD, UID, Creator note or manual tags.";

function typeUsername(value: string) {
  fireEvent.change(usernameInput(), { target: { value } });
}

function chooseBd(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Responsible BD" }));
  fireEvent.click(screen.getByText(name));
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    BATCH_ID as `${string}-${string}-${string}-${string}-${string}`,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const BLANK = {
  sellerProvidedUid: "",
  sellerNote: "",
  manualTagNames: [] as string[],
};

describe("buildAffiliateCreatorAddEntry", () => {
  it("strips whitespace and a leading @ from the username", () => {
    expect(normalizeCreatorUsername("  @creator.one ")).toBe("creator.one");
    expect(normalizeCreatorUsername("creator.one")).toBe("creator.one");
  });

  it("builds an additive protected entry with a trimmed note", () => {
    expect(
      buildAffiliateCreatorAddEntry({
        username: " @creator.one ",
        businessDeveloperId: "bd-1",
        protect: true,
        protectionNote: "  VIP  ",
        ...BLANK,
      }),
    ).toEqual({
      platform: GQL.ShopPlatform.TiktokShop,
      creatorOpenId: null,
      username: "creator.one",
      businessDeveloperId: "bd-1",
      protect: true,
      protectionNote: "VIP",
      overwrite: false,
      businessDeveloperOnly: false,
      manualTagNames: [],
    });
  });

  it("sends a null note when the note is blank or protection is off", () => {
    const base = { username: "a", businessDeveloperId: "bd-1", ...BLANK };
    expect(
      buildAffiliateCreatorAddEntry({ ...base, protect: true, protectionNote: "   " })
        .protectionNote,
    ).toBeNull();
    expect(
      buildAffiliateCreatorAddEntry({ ...base, protect: false, protectionNote: "left over" })
        .protectionNote,
    ).toBeNull();
  });
});

describe("buildAffiliateCreatorAddEntry seller metadata and tags", () => {
  const base = { username: "a", businessDeveloperId: null, protect: true, protectionNote: "" };

  it("omits a blank UID and note instead of sending null, which would clear stored values", () => {
    const entry = buildAffiliateCreatorAddEntry({
      ...base,
      sellerProvidedUid: "   ",
      sellerNote: "\n  ",
      manualTagNames: [],
    });
    expect(Object.keys(entry)).not.toContain("sellerProvidedUid");
    expect(Object.keys(entry)).not.toContain("sellerNote");
    expect(Object.values(entry)).not.toContain(undefined);
  });

  it("sends the trimmed UID and note and the selected tag names", () => {
    const entry = buildAffiliateCreatorAddEntry({
      ...base,
      sellerProvidedUid: " UID-9 ",
      sellerNote: "  Prefers WhatsApp  ",
      manualTagNames: ["VIP", "Beauty"],
    });
    expect(entry).toMatchObject({
      sellerProvidedUid: "UID-9",
      sellerNote: "Prefers WhatsApp",
      manualTagNames: ["VIP", "Beauty"],
      overwrite: false,
      businessDeveloperOnly: false,
    });
  });
});

describe("AffiliateCreatorAddModal", () => {
  it("starts protected, with the note enabled and submit waiting for a username", () => {
    setup({ data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied) });

    expect(protectBox().checked).toBe(true);
    expect(noteInput().disabled).toBe(false);
    expect(submitButton().disabled).toBe(true);

    typeUsername("@creator.one");
    expect(submitButton().disabled).toBe(false);
  });

  it("submits a protected Creator with a BD, then closes, toasts and asks the page to refetch", async () => {
    const { sent, onClose, onAdded } = setup({
      data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied),
    });

    typeUsername(" @creator.one ");
    chooseBd("Maria");
    fireEvent.change(noteInput(), { target: { value: "Met at the expo" } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(sent.at(-1)).toEqual({
      input: {
        importBatchId: BATCH_ID,
        entries: [
          {
            platform: GQL.ShopPlatform.TiktokShop,
            creatorOpenId: null,
            username: "creator.one",
            businessDeveloperId: "bd-1",
            protect: true,
            protectionNote: "Met at the expo",
            overwrite: false,
            businessDeveloperOnly: false,
            manualTagNames: [],
          },
        ],
      },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(
        "Added @creator.one, responsible BD: Maria. If this Creator is not in the system yet, they will be assigned to Maria once they appear.",
      ),
    ).toBeTruthy();
  });

  it("says plainly that a protected Creator without a BD is left alone by the AI", async () => {
    const { sent, onAdded } = setup({
      data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied),
    });

    typeUsername("creator.one");
    fireEvent.click(submitButton());

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(sent.at(-1)?.input.entries[0]).toMatchObject({
      businessDeveloperId: null,
      protect: true,
    });
    expect(
      screen.getByText("Protected @creator.one. The AI will not contact this Creator."),
    ).toBeTruthy();
  });

  it("requires a BD when protection is off, and disables the note", async () => {
    const { sent, onAdded } = setup({
      data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied),
    });

    typeUsername("creator.one");
    fireEvent.change(noteInput(), { target: { value: "will be dropped" } });
    fireEvent.click(protectBox());

    expect(noteInput().disabled).toBe(true);
    expect(screen.getByText(NOTHING_TO_APPLY)).toBeTruthy();
    expect(submitButton().disabled).toBe(true);

    chooseBd("Chen");
    expect(screen.queryByText(NOTHING_TO_APPLY)).toBeNull();
    expect(submitButton().disabled).toBe(false);

    fireEvent.click(submitButton());
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(sent.at(-1)?.input.entries[0]).toMatchObject({
      username: "creator.one",
      businessDeveloperId: "bd-2",
      protect: false,
      protectionNote: null,
      overwrite: false,
      businessDeveloperOnly: false,
    });
    expect(screen.getByText("Assigned @creator.one to Chen.")).toBeTruthy();
  });

  it("closes with a neutral message when nothing changed", async () => {
    const { onClose, onAdded } = setup({
      data: payload(GQL.AffiliateCreatorBulkUpdateStatus.NoOp),
    });

    typeUsername("creator.one");
    fireEvent.click(submitButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("@creator.one was already set up this way. Nothing changed."),
    ).toBeTruthy();
  });

  it("keeps the modal open and shows the rejection reason inline", async () => {
    const { onClose, onAdded } = setup({
      data: payload(
        GQL.AffiliateCreatorBulkUpdateStatus.Rejected,
        "AffiliateCreatorRelationship not found",
      ),
    });

    typeUsername("creator.one");
    chooseBd("Maria");
    fireEvent.click(protectBox());
    fireEvent.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("AffiliateCreatorRelationship not found");
    expect(alert.textContent).toContain(
      "If this Creator is not in the system yet, turn on protection to register them first.",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
    expect(usernameInput().value).toBe("creator.one");
  });

  it("does not suggest protection when a protected add is rejected", async () => {
    setup({
      data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Failed, "Backend exploded"),
    });

    typeUsername("creator.one");
    fireEvent.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Backend exploded");
    expect(alert.textContent).not.toContain("turn on protection");
  });

  it("surfaces a thrown error inline instead of swallowing it", async () => {
    const { onClose, onAdded } = setup({ error: new Error("Network down") });

    typeUsername("creator.one");
    fireEvent.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Network down");
    expect(onClose).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("leaves UID and note out of the request when they are blank", async () => {
    const { sent, onAdded } = setup({
      data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied),
    });

    typeUsername("creator.one");
    fireEvent.click(submitButton());

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    const entry = sent.at(-1)?.input.entries[0] as unknown as Record<string, unknown>;
    expect(Object.keys(entry)).not.toContain("sellerProvidedUid");
    expect(Object.keys(entry)).not.toContain("sellerNote");
    expect(entry.manualTagNames).toEqual([]);
  });

  it("sends a filled UID, creator note and the picked tags in catalog order", async () => {
    const { sent, onAdded } = setup({
      data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied),
    });

    typeUsername("creator.one");
    fireEvent.change(uidInput(), { target: { value: " 7312-UID " } });
    fireEvent.change(creatorNoteInput(), { target: { value: "  Prefers WhatsApp  " } });
    fireEvent.click(tagOption("Beauty"));
    fireEvent.click(tagOption("VIP"));
    fireEvent.click(submitButton());

    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(sent.at(-1)?.input.entries[0]).toMatchObject({
      username: "creator.one",
      protect: true,
      overwrite: false,
      businessDeveloperOnly: false,
      sellerProvidedUid: "7312-UID",
      sellerNote: "Prefers WhatsApp",
      manualTagNames: ["VIP", "Beauty"],
    });
  });

  it("flags a UID over 128 characters and a creator note over 5000, and blocks submit", () => {
    setup({ data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied) });
    typeUsername("creator.one");

    fireEvent.change(uidInput(), { target: { value: "u".repeat(128) } });
    expect(submitButton().disabled).toBe(false);
    fireEvent.change(uidInput(), { target: { value: "u".repeat(129) } });
    expect(screen.getByText("Keep this within 128 characters (currently 129).")).toBeTruthy();
    expect(uidInput().getAttribute("aria-invalid")).toBe("true");
    expect(submitButton().disabled).toBe(true);
    fireEvent.change(uidInput(), { target: { value: "" } });
    expect(submitButton().disabled).toBe(false);

    fireEvent.change(creatorNoteInput(), { target: { value: "n".repeat(5000) } });
    expect(submitButton().disabled).toBe(false);
    fireEvent.change(creatorNoteInput(), { target: { value: "n".repeat(5001) } });
    expect(screen.getByText("Keep this within 5000 characters (currently 5001).")).toBeTruthy();
    expect(creatorNoteInput().getAttribute("aria-invalid")).toBe("true");
    expect(submitButton().disabled).toBe(true);
  });

  it("measures the limits on the trimmed value", () => {
    setup({ data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied) });
    typeUsername("creator.one");

    fireEvent.change(uidInput(), { target: { value: `  ${"u".repeat(128)}  ` } });
    expect(submitButton().disabled).toBe(false);
  });

  it("lets an unprotected add through with only tags, and with only a UID or only a note", async () => {
    const { sent, onAdded } = setup({
      data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied),
    });

    typeUsername("creator.one");
    fireEvent.click(protectBox());
    expect(screen.getByText(NOTHING_TO_APPLY)).toBeTruthy();
    expect(submitButton().disabled).toBe(true);

    fireEvent.change(uidInput(), { target: { value: "UID-1" } });
    expect(submitButton().disabled).toBe(false);
    fireEvent.change(uidInput(), { target: { value: "" } });
    fireEvent.change(creatorNoteInput(), { target: { value: "context" } });
    expect(submitButton().disabled).toBe(false);
    fireEvent.change(creatorNoteInput(), { target: { value: "  " } });
    expect(submitButton().disabled).toBe(true);

    fireEvent.click(tagOption("Beauty"));
    expect(screen.queryByText(NOTHING_TO_APPLY)).toBeNull();
    expect(submitButton().disabled).toBe(false);

    fireEvent.click(submitButton());
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(sent.at(-1)?.input.entries[0]).toMatchObject({
      username: "creator.one",
      businessDeveloperId: null,
      protect: false,
      protectionNote: null,
      manualTagNames: ["Beauty"],
    });
  });

  it("filters the catalog by search and toggles selection with pills", () => {
    setup({ data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied) });

    fireEvent.change(tagSearchInput(), { target: { value: " vip " } });
    expect(screen.getByRole("button", { name: "VIP" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vip-lite" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Beauty" })).toBeNull();

    fireEvent.click(tagOption("VIP"));
    expect(screen.getByRole("button", { name: "VIP", pressed: true })).toBeTruthy();
    const remove = screen.getByRole("button", { name: "Remove tag VIP" });
    expect(remove.closest("li")?.textContent).toContain("VIP");

    // A selected tag stays selected while the search hides it.
    fireEvent.change(tagSearchInput(), { target: { value: "beau" } });
    expect(screen.getByRole("button", { name: "Remove tag VIP" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove tag VIP" }));
    expect(screen.queryByRole("button", { name: "Remove tag VIP" })).toBeNull();
  });

  it("explains an empty catalog, a search with no match, and a catalog that is still loading", () => {
    setup({ data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied) }, { tags: [] });
    expect(screen.getByText(/There are no manual tags yet/)).toBeTruthy();
    cleanup();

    setup({ data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied) });
    fireEvent.change(tagSearchInput(), { target: { value: "zzz" } });
    expect(screen.getByText("No tags match your search.")).toBeTruthy();
    cleanup();

    setup(
      { data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied) },
      { tags: [], tagsLoading: true },
    );
    expect(screen.queryByText(/There are no manual tags yet/)).toBeNull();
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("warns up front that UID, note and tags need a Creator already in the system", () => {
    setup({ data: payload(GQL.AffiliateCreatorBulkUpdateStatus.Applied) });
    expect(screen.getByText(/can only be written to a Creator already in the system/)).toBeTruthy();
  });
});
