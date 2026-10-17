import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import type { AccountMember, AccountRole } from "../hooks/useSubAccounts.js";
import { SubAccountFormModal } from "./SubAccountFormModal.js";
import { SubAccountsSection } from "./SubAccountsSection.js";

const mocks = vi.hoisted(() => ({
  subAccounts: null as unknown,
  switchToMember: vi.fn(),
  showToast: vi.fn(),
}));
vi.mock("../../../api/account-switch.js", () => ({ switchToMember: mocks.switchToMember }));
vi.mock("../../../components/Toast.js", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../hooks/useSubAccounts.js", () => ({
  useSubAccounts: () => mocks.subAccounts,
}));

const NOW = "2026-09-28T00:00:00.000Z";

const ROLES: AccountRole[] = [
  {
    id: "role-bd",
    name: "Business Developer",
    isSystem: true,
    systemKey: GQL.AccountSystemRoleKey.BusinessDeveloper,
    memberCount: 1,
    scopes: [GQL.PermissionScope.AffiliateBusinessDeveloper],
  },
  {
    id: "role-supervisor",
    name: "Affiliate Supervisor",
    isSystem: true,
    systemKey: GQL.AccountSystemRoleKey.AffiliateSupervisor,
    memberCount: 0,
    scopes: [GQL.PermissionScope.Affiliate],
  },
  {
    id: "role-ops",
    name: "Ops",
    isSystem: false,
    systemKey: null,
    memberCount: 1,
    scopes: [GQL.PermissionScope.Inventory],
  },
];

const MEMBERS: AccountMember[] = [
  {
    id: "member-bd",
    email: "maria@example.com",
    name: "Maria",
    roleId: "role-bd",
    roleName: "Business Developer",
    roleSystemKey: GQL.AccountSystemRoleKey.BusinessDeveloper,
    scopes: [GQL.PermissionScope.AffiliateBusinessDeveloper],
    disabled: false,
    createdAt: NOW,
  },
  {
    id: "member-ops",
    email: "ops@example.com",
    name: "Olga",
    roleId: "role-ops",
    roleName: "Ops",
    roleSystemKey: null,
    scopes: [GQL.PermissionScope.Inventory],
    disabled: false,
    createdAt: NOW,
  },
];

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mocks.subAccounts = {
    members: MEMBERS,
    roles: ROLES,
    loading: false,
    loadError: null,
    savingMember: false,
    deletingMember: false,
    savingRole: false,
    deletingRole: false,
    createMember: vi.fn(),
    updateMember: vi.fn(),
    deleteMember: vi.fn(),
    writeRole: vi.fn(),
    deleteRole: vi.fn(),
  };
});
afterEach(cleanup);

function memberRow(email: string): HTMLElement {
  return screen.getAllByText(email)[0]!.closest(".acct-item") as HTMLElement;
}

function roleRow(name: string): HTMLElement {
  return screen
    .getAllByText(name)
    .map((element) => element.closest(".acct-item"))
    .find((row) => row?.closest(".acct-role-panel")) as HTMLElement;
}

describe("SubAccountFormModal", () => {
  it("never offers the Business Developer role and defaults to an assignable one", () => {
    render(
      <SubAccountFormModal
        isOpen
        editingMember={null}
        roles={ROLES}
        saving={false}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("dialog").querySelector(".custom-select-trigger")!;
    expect(trigger.textContent).toContain("Business Developer Supervisor");
    fireEvent.click(trigger);
    const options = Array.from(document.querySelectorAll(".custom-select-option-label")).map(
      (option) => option.textContent,
    );
    expect(options).toEqual(["Business Developer Supervisor", "Ops"]);
  });
});

describe("SubAccountsSection", () => {
  it.each([
    [
      "ACCOUNT_SWITCH_CLIENT_UNAVAILABLE",
      "客户端尚未加载子账号登录功能，请完全退出并重新打开客户端后再试。",
    ],
    [
      "ACCOUNT_SWITCH_BACKEND_UNAVAILABLE",
      "服务端尚未部署子账号登录功能，请部署完成后再试。这不是子账号权限问题。",
    ],
  ])("explains version mismatch in Chinese (%s)", async (code, message) => {
    await i18n.changeLanguage("zh");
    mocks.switchToMember.mockRejectedValueOnce(Object.assign(new Error("Not found"), { code }));
    render(<SubAccountsSection />);
    fireEvent.click(
      within(memberRow("maria@example.com")).getByRole("button", { name: "登录为此子账号" }),
    );
    await waitFor(() =>
      expect(mocks.showToast).toHaveBeenCalledWith(expect.stringContaining(message), "error"),
    );
  });
  it("starts temporary login for the selected BD and disables disabled members", async () => {
    render(<SubAccountsSection />);
    fireEvent.click(
      within(memberRow("maria@example.com")).getByRole("button", {
        name: "Sign in as sub-account",
      }),
    );
    expect(mocks.switchToMember).toHaveBeenCalledWith("member-bd");
  });

  it("shows a business developer's login read-only and points to the Team page", () => {
    render(<SubAccountsSection />);

    const bd = memberRow("maria@example.com");
    expect(within(bd).getByRole("button", { name: "Sign in as sub-account" })).toBeTruthy();
    expect(within(bd).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(within(bd).getByText(/Manage it in .* → Team & channels\./)).toBeTruthy();
    expect(within(bd).getByText("BD workspace")).toBeTruthy();

    const ops = memberRow("ops@example.com");
    expect(within(ops).getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(within(ops).getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("names built-in roles by their key and offers no edit or delete on any of them", () => {
    render(<SubAccountsSection />);

    const bdRole = roleRow("Business Developer");
    expect(within(bdRole).queryByRole("button")).toBeNull();
    expect(within(bdRole).getByText(/Its sections are fixed\./)).toBeTruthy();

    const supervisorRole = roleRow("Business Developer Supervisor");
    expect(within(supervisorRole).queryByRole("button")).toBeNull();
    expect(within(supervisorRole).getByText(/cannot be edited or deleted/)).toBeTruthy();

    fireEvent.click(within(roleRow("Ops")).getByRole("button", { name: "Edit" }));
    const scopeLabels = Array.from(
      document.querySelectorAll(".acct-role-scope-grid .form-checkbox-label"),
    ).map((label) => label.textContent);
    expect(scopeLabels).toContain("Affiliate");
    expect(scopeLabels).not.toContain("BD workspace");
  });
});
