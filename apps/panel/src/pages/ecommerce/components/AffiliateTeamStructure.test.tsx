// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { buildTeamTree, type TeamStructure } from "../affiliate-team-structure.js";
import { AffiliateTeamLeadEditor } from "./AffiliateTeamLeadEditor.js";
import { AffiliateRegionAdminEditor } from "./AffiliateRegionAdminEditor.js";
import { AffiliateTeamStructureTree } from "./AffiliateTeamStructureTree.js";

const storeState = vi.hoisted(() => ({ shops: [] as Array<Record<string, unknown>> }));
vi.mock("../../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => storeState }));
const openPanelRoute = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/open-route.js", () => ({ openPanelRoute }));

beforeEach(async () => {
  await i18n.changeLanguage("en");
  storeState.shops = [
    {
      id: "shop-us",
      platform: "TIKTOK_SHOP",
      region: "US",
      alias: null,
      shopName: "US Shop",
      platformShopId: "p1",
    },
    {
      id: "shop-gb",
      platform: "TIKTOK_SHOP",
      region: "GB",
      alias: null,
      shopName: "GB Shop",
      platformShopId: "p2",
    },
  ];
});
afterEach(() => {
  cleanup();
  openPanelRoute.mockReset();
});

const member = (userId: string, email: string, profileId: string | null = null) => ({
  userId,
  email,
  name: null,
  profileId,
});

function structure(overrides: Partial<TeamStructure> = {}): TeamStructure {
  return {
    teamLeads: [
      {
        id: "head",
        memberUserId: "u-head",
        displayName: "Head Lead",
        parentLeadId: null,
        permissions: [GQL.AffiliateStaffPermission.View],
        archivedAt: null,
      },
      {
        id: "mid",
        memberUserId: "u-mid",
        displayName: "Mid Lead",
        parentLeadId: "head",
        permissions: [GQL.AffiliateStaffPermission.View, GQL.AffiliateStaffPermission.Operate],
        archivedAt: null,
      },
      {
        id: "old",
        memberUserId: "u-old",
        displayName: "Old Lead",
        parentLeadId: null,
        permissions: [],
        archivedAt: "2026-11-01T00:00:00Z",
      },
    ],
    regionAdmins: [
      {
        id: "ra1",
        memberUserId: "u-ra",
        displayName: "UK Admin",
        regions: [GQL.ShopRegion.Gb],
        shopIds: [],
        permissions: [GQL.AffiliateStaffPermission.Allocate],
        archivedAt: null,
      },
    ],
    businessDevelopers: [
      { id: "bd1", displayName: "Ann BD", parentLeadId: "mid" },
      { id: "bd2", displayName: "Zed BD", parentLeadId: null },
    ],
    eligibleTeamLeadMembers: [
      member("u-head", "head@x.com", "head"),
      member("u-mid", "mid@x.com", "mid"),
      member("u-free", "free@x.com"),
    ],
    eligibleRegionAdminMembers: [member("u-ra", "ra@x.com", "ra1"), member("u-ra2", "ra2@x.com")],
    ...overrides,
  };
}

/** A node's own name; the same text also appears in other rows' parent pickers. */
const nameOf = (text: string) => screen.getByText(text, { selector: "strong span" });

async function choose(triggerName: string, optionText: string) {
  fireEvent.click(screen.getByRole("button", { name: triggerName }));
  fireEvent.click(await screen.findByText(optionText, { selector: ".custom-select-option-label" }));
}

describe("AffiliateTeamStructureTree", () => {
  function renderTree(handlers: Partial<Parameters<typeof AffiliateTeamStructureTree>[0]> = {}) {
    const data = structure();
    const props = {
      tree: buildTeamTree(data),
      structure: data,
      busyId: null,
      onSetParent: vi.fn(),
      onEditLead: vi.fn(),
      onArchiveLead: vi.fn(),
      ...handlers,
    };
    render(<AffiliateTeamStructureTree {...props} />);
    return props;
  }

  it("nests leads and BDs, lists unparented BDs apart, and hides archived leads", () => {
    renderTree();
    const head = nameOf("Head Lead").closest("li")!;
    expect(within(head).getByText("Mid Lead", { selector: "strong span" })).toBeTruthy();
    expect(within(head).getByText("Ann BD", { selector: "strong span" })).toBeTruthy();
    expect(screen.queryByText("Old Lead")).toBeNull();
    const unparented = screen.getByText("Not in any team").closest("section")!;
    expect(within(unparented).getByText("Zed BD", { selector: "strong span" })).toBeTruthy();
    expect(within(unparented).queryByText("Ann BD")).toBeNull();
  });

  it("sets a BD's parent lead and detaches it again", async () => {
    const props = renderTree();
    await choose("Zed BD reports to", "Head Lead");
    expect(props.onSetParent).toHaveBeenLastCalledWith(
      { kind: "BUSINESS_DEVELOPER", id: "bd2" },
      "head",
    );
    await choose("Ann BD reports to", "No team lead");
    expect(props.onSetParent).toHaveBeenLastCalledWith(
      { kind: "BUSINESS_DEVELOPER", id: "bd1" },
      null,
    );
  });

  it("never offers a lead itself or its descendants as its own parent", () => {
    renderTree();
    fireEvent.click(screen.getByRole("button", { name: "Head Lead reports to" }));
    const labels = screen
      .getAllByText(/Lead$|No team lead/, { selector: ".custom-select-option-label" })
      .map((node) => node.textContent);
    expect(labels).toEqual(["No team lead"]);
  });

  it("routes edit and archive to the lead", () => {
    const props = renderTree();
    const row = nameOf("Mid Lead").closest(".affiliate-team-structure-row") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    fireEvent.click(within(row).getByRole("button", { name: "Archive" }));
    expect(props.onEditLead).toHaveBeenCalledWith("mid");
    expect(props.onArchiveLead).toHaveBeenCalledWith("mid");
  });
});

describe("AffiliateTeamLeadEditor", () => {
  const noop = () => undefined;

  it("creates a lead from a free member, a name and a parent lead", async () => {
    const onSave = vi.fn();
    render(
      <AffiliateTeamLeadEditor
        structure={structure()}
        leadId={null}
        saving={false}
        onClose={noop}
        onSave={onSave}
      />,
    );
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await choose("Member", "free@x.com");
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: " New Lead " } });
    await choose("Reports to", "Mid Lead");
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith({
      id: undefined,
      memberUserId: "u-free",
      displayName: "New Lead",
      parentLeadId: "mid",
      permissions: ["VIEW"],
      displayNameChanged: true,
      parentLeadIdChanged: true,
      permissionsChanged: true,
    });
  });

  it("fills the display name from the picked member until the admin types one", async () => {
    render(
      <AffiliateTeamLeadEditor
        structure={structure({
          eligibleTeamLeadMembers: [
            { ...member("u-ann", "ann@x.com"), name: "Ann" },
            { ...member("u-bo", "bo@x.com"), name: "Bo" },
          ],
        })}
        leadId={null}
        saving={false}
        onClose={noop}
        onSave={vi.fn()}
      />,
    );
    const name = screen.getByLabelText("Display name") as HTMLInputElement;
    await choose("Member", "Ann (ann@x.com)");
    expect(name.value).toBe("Ann");
    await choose("Member", "Bo (bo@x.com)");
    expect(name.value).toBe("Bo");
    fireEvent.change(name, { target: { value: "Head of US" } });
    await choose("Member", "Ann (ann@x.com)");
    expect(name.value).toBe("Head of US");
  });

  it("only offers members without a live profile", () => {
    render(
      <AffiliateTeamLeadEditor
        structure={structure()}
        leadId={null}
        saving={false}
        onClose={noop}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Member" }));
    expect(
      screen.getByText("free@x.com", { selector: ".custom-select-option-label" }),
    ).toBeTruthy();
    expect(
      screen.queryByText("head@x.com", { selector: ".custom-select-option-label" }),
    ).toBeNull();
  });

  it("explains the empty state and links to the members page when nobody is eligible", () => {
    render(
      <AffiliateTeamLeadEditor
        structure={structure({ eligibleTeamLeadMembers: [member("u-head", "head@x.com", "head")] })}
        leadId={null}
        saving={false}
        onClose={noop}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText(/No free member holds the Affiliate Team Lead role/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open members" }));
    expect(openPanelRoute).toHaveBeenCalledWith("/account/profile");
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("edits an existing lead without sending unchanged fields, and excludes its own subtree", async () => {
    const onSave = vi.fn();
    render(
      <AffiliateTeamLeadEditor
        structure={structure()}
        leadId="head"
        saving={false}
        onClose={noop}
        onSave={onSave}
      />,
    );
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByText("head@x.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reports to" }));
    expect(screen.queryByText("Mid Lead", { selector: ".custom-select-option-label" })).toBeNull();
    fireEvent.click(screen.getByText("No team lead", { selector: ".custom-select-option-label" }));
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Head Renamed" } });
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith({
      id: "head",
      memberUserId: undefined,
      displayName: "Head Renamed",
      parentLeadId: null,
      permissions: ["VIEW"],
      displayNameChanged: true,
      parentLeadIdChanged: false,
      permissionsChanged: false,
    });
  });
});

describe("AffiliateRegionAdminEditor", () => {
  const noop = () => undefined;

  it("cannot save a new region admin until a region or shop is chosen, then saves the ADR-110 scope", async () => {
    const onSave = vi.fn();
    render(
      <AffiliateRegionAdminEditor
        structure={structure()}
        adminId={null}
        saving={false}
        onClose={noop}
        onSave={onSave}
      />,
    );
    await choose("Member", "ra2@x.com");
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "US Admin" } });
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(/Select at least one region or shop/);
    fireEvent.click(screen.getByRole("checkbox", { name: "US Shop" }));
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith({
      id: undefined,
      memberUserId: "u-ra2",
      displayName: "US Admin",
      regions: [],
      shopIds: ["shop-us"],
      permissions: ["ALLOCATE"],
      permissionsChanged: true,
    });
  });

  it("uses region admin wording for the scope choices and sends empty grants for all shops", () => {
    const onSave = vi.fn();
    render(
      <AffiliateRegionAdminEditor
        structure={structure()}
        adminId="ra1"
        saving={false}
        onClose={noop}
        onSave={onSave}
      />,
    );
    expect(screen.getByText(/This region admin only reaches the regions and shops/)).toBeTruthy();
    expect(screen.queryByText(/This BD/)).toBeNull();
    expect(screen.getByText("ra@x.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /All shops/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({
      id: "ra1",
      memberUserId: undefined,
      displayName: "UK Admin",
      regions: [],
      shopIds: [],
      permissions: ["ALLOCATE"],
      permissionsChanged: false,
    });
  });
});

describe("staff permission checkboxes", () => {
  const noop = () => undefined;
  const box = (name: string) =>
    screen.getByRole("checkbox", { name: new RegExp(`^${name}`) }) as HTMLInputElement;

  it("prefills a new team lead with VIEW and a new region admin with ALLOCATE", () => {
    render(
      <AffiliateTeamLeadEditor
        structure={structure()}
        leadId={null}
        saving={false}
        onClose={noop}
        onSave={vi.fn()}
      />,
    );
    expect([
      box("View business status").checked,
      box("Operate business status").checked,
      box("Allocate Creators").checked,
    ]).toEqual([true, false, false]);
    cleanup();
    render(
      <AffiliateRegionAdminEditor
        structure={structure()}
        adminId={null}
        saving={false}
        onClose={noop}
        onSave={vi.fn()}
      />,
    );
    expect([
      box("View business status").checked,
      box("Operate business status").checked,
      box("Allocate Creators").checked,
    ]).toEqual([false, false, true]);
  });

  it("ticks VIEW with OPERATE and unticks OPERATE with VIEW", () => {
    render(
      <AffiliateRegionAdminEditor
        structure={structure()}
        adminId="ra1"
        saving={false}
        onClose={noop}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(box("Operate business status"));
    expect(box("View business status").checked).toBe(true);
    expect(box("Operate business status").checked).toBe(true);
    fireEvent.click(box("View business status"));
    expect(box("Operate business status").checked).toBe(false);
  });

  it("offers Create Campaigns on a region admin profile and never on a team lead profile (ADR-118)", () => {
    render(
      <AffiliateTeamLeadEditor
        structure={structure()}
        leadId="head"
        saving={false}
        onClose={noop}
        onSave={vi.fn()}
      />,
    );
    expect(screen.queryByRole("checkbox", { name: /^Create Campaigns/ })).toBeNull();
    cleanup();
    render(
      <AffiliateRegionAdminEditor
        structure={structure()}
        adminId="ra1"
        saving={false}
        onClose={noop}
        onSave={vi.fn()}
      />,
    );
    expect(box("Create Campaigns").checked).toBe(false);
  });

  it("saves CAMPAIGN on a region admin independently of the other permissions", () => {
    const onSave = vi.fn();
    render(
      <AffiliateRegionAdminEditor
        structure={structure()}
        adminId="ra1"
        saving={false}
        onClose={noop}
        onSave={onSave}
      />,
    );
    fireEvent.click(box("Create Campaigns"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ra1",
        permissions: ["ALLOCATE", "CAMPAIGN"],
        permissionsChanged: true,
      }),
    );
  });

  it("sends the changed permissions of a lead and marks them changed", () => {
    const onSave = vi.fn();
    render(
      <AffiliateTeamLeadEditor
        structure={structure()}
        leadId="head"
        saving={false}
        onClose={noop}
        onSave={onSave}
      />,
    );
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(box("Operate business status"));
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "head",
        permissions: ["VIEW", "OPERATE"],
        permissionsChanged: true,
        displayNameChanged: false,
      }),
    );
  });

  it("shows each profile's permissions as short labels in the tree", () => {
    render(
      <AffiliateTeamStructureTree
        tree={buildTeamTree(structure())}
        structure={structure()}
        busyId={null}
        onSetParent={vi.fn()}
        onEditLead={vi.fn()}
        onArchiveLead={vi.fn()}
      />,
    );
    expect(screen.getAllByText("View").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Operate").length).toBe(1);
  });
});
