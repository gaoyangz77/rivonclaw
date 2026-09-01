// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddWmsAccountModal } from "./AddWmsAccountModal.js";

const translations: Record<string, string> = {
  "ecommerce.inventory.addWmsAccount": "Add WMS Account",
  "ecommerce.inventory.provider": "Provider",
  "ecommerce.inventory.label": "Label",
  "ecommerce.inventory.endpoint": "Endpoint",
  "ecommerce.inventory.currency": "Currency",
  "ecommerce.inventory.apiKey": "API Key",
  "ecommerce.inventory.apiSecret": "API Secret",
  "ecommerce.inventory.apiToken": "API Token",
  "ecommerce.inventory.authorizationMode": "Connection method",
  "ecommerce.inventory.authorizationModes.AUTHORIZE": "Authorize OMS",
  "ecommerce.inventory.authorizationModes.EXISTING": "Existing grant",
  "ecommerce.inventory.authorizationUser": "OMS account email",
  "ecommerce.inventory.authorizationToken": "One-time authorization token",
  "ecommerce.inventory.authorizationDomain": "Authorization domain",
  "ecommerce.inventory.refreshToken": "Refresh Token",
  "ecommerce.inventory.providerUserId": "Provider User ID",
  "ecommerce.inventory.credentialsWriteOnlyHint": "Credentials are write-only.",
  "common.cancel": "Cancel",
};

let draft: Record<string, any>;
const inventory = {
  addWmsAccountModalOpen: true,
  addWmsAccountSaving: false,
  addWmsAccountError: null,
  get addWmsAccountDraft() {
    return draft;
  },
  isEditingWmsAccount: false,
  setAddWmsAccountModalOpen: vi.fn(),
  updateAddWmsAccountDraft: vi.fn(),
  saveWmsAccount: vi.fn().mockResolvedValue(undefined),
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      translations[key] ?? options?.defaultValue ?? key,
  }),
}));

vi.mock("../../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({ ecommerceInventory: inventory }),
}));

function makeDraft(
  authorizationMode: "AUTHORIZE" | "EXISTING",
  provider = "JFWMS",
) {
  return {
    id: null,
    provider,
    label: "",
    endpoint: "",
    declaredValueCurrency: "",
    apiToken: "",
    apiKey: "",
    apiSecret: "",
    refreshToken: "",
    providerUserId: "",
    authorizationMode,
    authorizationUser: "",
    authorizationToken: "",
    authorizationDomain: "",
    notes: "",
    originalEndpoint: "",
  };
}

beforeEach(() => {
  inventory.isEditingWmsAccount = false;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AddWmsAccountModal", () => {
  it("renders JFWMS one-time OMS authorization fields", () => {
    draft = makeDraft("AUTHORIZE");
    render(<AddWmsAccountModal />);

    expect(screen.getByText("Authorize OMS")).toBeTruthy();
    expect(screen.getByText("OMS account email")).toBeTruthy();
    expect(screen.getByText("One-time authorization token")).toBeTruthy();
    expect(screen.queryByText("Refresh Token")).toBeNull();
  });

  it("renders the existing refresh-grant fields without a JSON token box", () => {
    draft = makeDraft("EXISTING");
    render(<AddWmsAccountModal />);

    expect(screen.getByText("Refresh Token")).toBeTruthy();
    expect(screen.getByText("Provider User ID")).toBeTruthy();
    expect(screen.queryByText("OMS account email")).toBeNull();
  });

  it("shows only the token field for a static-token provider", () => {
    draft = makeDraft("EXISTING", "YEJOIN");
    render(<AddWmsAccountModal />);

    expect(screen.getByText("API Token")).toBeTruthy();
    expect(screen.queryByText("API Key")).toBeNull();
    expect(screen.queryByText("API Secret")).toBeNull();
  });

  it("shows only key and secret fields for a key/secret provider", () => {
    draft = makeDraft("EXISTING", "XLWMS");
    render(<AddWmsAccountModal />);

    expect(screen.getByText("API Key")).toBeTruthy();
    expect(screen.getByText("API Secret")).toBeTruthy();
    expect(screen.queryByText("API Token")).toBeNull();
  });
});
