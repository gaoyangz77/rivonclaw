import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApolloClient, ApolloLink, InMemoryCache, Observable } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { GraphQLError } from "graphql";
import i18n from "../../../i18n/index.js";
import { AffiliateCampaignInvitationComposer } from "./AffiliateCampaignInvitationComposer.js";

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup(options: { failures?: number; incomplete?: boolean; code?: string } = {}) {
  const operations: Array<{ name: string; variables: Record<string, any> }> = [];
  const onSent = vi.fn(),
    onBusyChange = vi.fn();
  let failures = options.failures ?? 0;
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      operations.push({
        name: operation.operationName ?? "",
        variables: structuredClone(operation.variables),
      });
      return new Observable((observer) => {
        if (operation.operationName === "AffiliateChatCampaignTemplates") {
          observer.next({
            data: {
              affiliateChatCampaignTemplates: [
                {
                  id: "campaign-1",
                  name: "Windboss invitation",
                  endDays: 30,
                  isSampleApprovalExempt: false,
                  sellerContactEmail: options.incomplete ? null : "seller@example.com",
                  products: [
                    {
                      productId: "product-1",
                      commissionRatePercent: 15,
                      shopAdsCommissionRatePercent: 5,
                    },
                  ],
                },
              ],
            },
          });
        } else if (failures-- > 0)
          observer.next({
            errors: [
              new GraphQLError("Request failed", {
                extensions: { code: options.code ?? "MANUAL_INVITATION_UNCERTAIN" },
              }),
            ],
          });
        else
          observer.next({
            data: {
              sendAffiliateCampaignInvitation: {
                delivery: { id: "delivery-1", status: "SENT", errorCode: null, errorMessage: null },
                affiliateCollaboration: { id: "local-invitation", shopId: "shop-1" },
              },
            },
          });
        observer.complete();
      });
    }),
  });
  const props = {
    shopId: "shop-1",
    creatorRelationshipId: "relationship-1",
    disabled: false,
    onBusyChange,
    onSent,
  };
  const view = render(
    <ApolloProvider client={client}>
      <AffiliateCampaignInvitationComposer {...props} />
    </ApolloProvider>,
  );
  return {
    operations,
    onSent,
    onBusyChange,
    ...view,
    rerenderShop(shopId: string) {
      view.rerender(
        <ApolloProvider client={client}>
          <AffiliateCampaignInvitationComposer {...props} shopId={shopId} />
        </ApolloProvider>,
      );
    },
  };
}
async function chooseTemplate() {
  fireEvent.click(screen.getByRole("button", { name: "发送定邀" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "选择推广计划" }).hasAttribute("disabled")).toBe(
      false,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "选择推广计划" }));
  fireEvent.change(screen.getByPlaceholderText("搜索推广计划"), { target: { value: "Windboss" } });
  fireEvent.click(screen.getByText("Windboss invitation"));
}
it("adds no mount query, loads shop templates on demand, and sends one separate invitation even on a double click", async () => {
  const { operations, onSent } = setup();
  expect(operations).toEqual([]);
  await chooseTemplate();
  expect(screen.getByText("1 个商品 · 有效期 30 天")).toBeTruthy();
  expect(screen.getByText(/普通佣金 15% · Shop Ads 佣金 5%/)).toBeTruthy();
  const button = screen.getByRole("button", { name: "创建并发送定邀" });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor(() => expect(onSent).toHaveBeenCalledOnce());
  expect(operations.map((o) => o.name)).toEqual([
    "AffiliateChatCampaignTemplates",
    "SendAffiliateCampaignInvitation",
  ]);
  expect(operations[1].variables.input).toMatchObject({
    shopId: "shop-1",
    creatorRelationshipId: "relationship-1",
    campaignId: "campaign-1",
  });
  expect(operations[1].variables.input.idempotencyKey).toMatch(/^manual-invite-ui:/);
});
it("keeps the same creation key when checking an uncertain result", async () => {
  const { operations, onSent } = setup({ failures: 1 });
  await chooseTemplate();
  fireEvent.click(screen.getByRole("button", { name: "创建并发送定邀" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("定邀创建结果尚未确认"),
  );
  fireEvent.click(screen.getByRole("button", { name: "创建并发送定邀" }));
  await waitFor(() => expect(onSent).toHaveBeenCalledOnce());
  expect(operations[1].variables.input.idempotencyKey).toBe(
    operations[2].variables.input.idempotencyKey,
  );
});
it("permits a new creation attempt only after an explicit platform refusal", async () => {
  const { operations, onSent } = setup({ failures: 1, code: "MANUAL_INVITATION_REJECTED" });
  await chooseTemplate();
  fireEvent.click(screen.getByRole("button", { name: "创建并发送定邀" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "创建并发送定邀" }));
  await waitFor(() => expect(onSent).toHaveBeenCalledOnce());
  expect(operations[1].variables.input.idempotencyKey).not.toBe(
    operations[2].variables.input.idempotencyKey,
  );
});
it("disables incomplete templates and clears template selection when changing shops", async () => {
  const { operations, rerenderShop } = setup({ incomplete: true });
  await chooseTemplate();
  expect(screen.getByRole("button", { name: "创建并发送定邀" }).hasAttribute("disabled")).toBe(
    true,
  );
  rerenderShop("shop-2");
  await waitFor(() => expect(screen.queryByRole("button", { name: "创建并发送定邀" })).toBeNull());
  expect(screen.getByRole("button", { name: "发送定邀" }).getAttribute("aria-expanded")).toBe(
    "false",
  );
  expect(operations.every((o) => o.name === "AffiliateChatCampaignTemplates")).toBe(true);
});
