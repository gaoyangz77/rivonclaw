import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { applySnapshot } from "mobx-state-tree";
import { runtimeStatusStore } from "../../store/runtime-status-store.js";
import { TkPrivate } from "../../components/design-system/index.js";
import { campaignProductReference, campaignShopDisplayName } from "./AffiliateCampaignPage.js";
import { sampleReviewRowProductLabel } from "./AffiliateManagementPage.js";
import type { AffiliateSampleProposalReviewRow } from "./AffiliateManagementPage.js";

/**
 * Privacy mode masks four kinds of seller data on the ecommerce pages: shop
 * names, product names, product images, and seller SKU text. These tests pin
 * the two halves of that contract — the resolver's sensitivity decision, and
 * the opt-in flags at the call sites that the mechanism cannot infer on its
 * own.
 */

function pageSource(fileName: string): string {
  return readFileSync(resolve(process.cwd(), `src/pages/ecommerce/${fileName}`), "utf8");
}

function setPrivacyMode(enabled: boolean) {
  applySnapshot(runtimeStatusStore.appSettings, { privacyMode: enabled });
}

/** Every `<RemoteMediaImage … />` element in a page, as source text. */
function remoteMediaImageBlocks(source: string): string[] {
  return source.match(/<RemoteMediaImage[\s\S]*?\/>/g) ?? [];
}

function blockFor(blocks: string[], sourceUrlExpression: string): string {
  const match = blocks.find((block) => block.includes(`sourceUrl={${sourceUrlExpression}}`));
  expect(match, `no RemoteMediaImage with sourceUrl={${sourceUrlExpression}}`).toBeDefined();
  return match as string;
}

afterEach(() => {
  cleanup();
  setPrivacyMode(false);
});

describe("shop labels on the ecommerce pages", () => {
  it("leaves an operator-chosen alias unmasked so shops stay apart on a shared screen", () => {
    const label = campaignShopDisplayName(
      { alias: "Five Shop", shopName: "Holylegend & DIYCOM" },
      "shop-id",
    );
    render(<TkPrivate sensitive={label.sensitive}>{label.text}</TkPrivate>);

    const node = screen.getByText("Five Shop");
    expect(node.getAttribute("data-tk-private")).toBeNull();
  });

  it("marks the platform shop name a label falls back to", () => {
    const label = campaignShopDisplayName({ alias: null, shopName: "Holylegend" }, "shop-id");
    render(
      <TkPrivate sensitive={label.sensitive} title={label.text}>
        {label.text}
      </TkPrivate>,
    );

    const node = screen.getByText("Holylegend");
    expect(node.getAttribute("data-tk-private")).toBe("text");
  });

  it("drops the tooltip of a masked shop name, which would otherwise spell it out", () => {
    setPrivacyMode(true);
    const label = campaignShopDisplayName({ alias: null, shopName: "Holylegend" }, "shop-id");
    render(
      <TkPrivate sensitive={label.sensitive} title={label.text}>
        {label.text}
      </TkPrivate>,
    );

    expect(screen.getByText("Holylegend").getAttribute("title")).toBeNull();
  });
});

describe("product images on the ecommerce pages", () => {
  it("opts the Campaign product covers into masking", () => {
    const blocks = remoteMediaImageBlocks(pageSource("AffiliateCampaignPage.tsx"));

    expect(blockFor(blocks, "selectedCampaign.productSnapshot.coverImage")).toContain("sensitive");
    expect(blockFor(blocks, "summary.coverImage")).toContain("sensitive");
  });

  it("opts the Affiliate workspace product covers in and leaves creator avatars alone", () => {
    const blocks = remoteMediaImageBlocks(pageSource("AffiliateManagementPage.tsx"));

    expect(blockFor(blocks, "product.coverImage")).toContain("sensitive");
    expect(blockFor(blocks, "productCoverImage")).toContain("sensitive");
    // A creator's avatar is not seller data and must stay visible.
    expect(blockFor(blocks, "avatarUrl")).not.toContain("sensitive");
  });

  it("opts the order line-item images in and leaves customer chat images alone", () => {
    const blocks = remoteMediaImageBlocks(pageSource("CustomerServiceEscalationsPage.tsx"));

    expect(blockFor(blocks, "item.skuImage")).toContain("sensitive");
    // An image a customer sent in chat is their content, not the seller's.
    expect(blockFor(blocks, "rich.url")).not.toContain("sensitive");
  });

  it("masks the plain <img> product previews by falling back to the empty state", () => {
    const source = pageSource("AffiliateCampaignPage.tsx");

    // A plain <img> cannot carry RemoteMediaImage's masked branch, so the cover
    // must not even be requested while privacy mode is on.
    expect(source).toContain("{rowPreview.coverImage && !privacyMode ? (");
    expect(source).toContain("{productPreview.coverImage && !privacyMode ? (");
  });
});

describe("seller SKU text on the ecommerce pages", () => {
  const t = (key: string) => key;
  /** The same stub, typed as the branded `TFunction` this helper declares. */
  const tf = t as unknown as Parameters<typeof sampleReviewRowProductLabel>[1];

  it("substitutes the SKU in a Campaign product reference and keeps the label", () => {
    const campaign = {
      products: [{ productId: "product-1" }],
      productSnapshot: { sellerSkus: ["HL-TEE-RED-L", "HL-TEE-RED-M"] },
    } as unknown as Parameters<typeof campaignProductReference>[0];

    expect(campaignProductReference(campaign, t, false)).toBe(
      "ecommerce.affiliateCampaign.skuLabel · HL-TEE-RED-L +1",
    );
    // The label and the overflow count are the operator's bearings, so only
    // the SKU is replaced — the reference stays a readable sentence.
    expect(campaignProductReference(campaign, t, true)).toBe(
      "ecommerce.affiliateCampaign.skuLabel · •••• +1",
    );
  });

  it("leaves a Campaign reference that falls back to the opaque product id alone", () => {
    const campaign = {
      products: [{ productId: "product-1" }],
      productSnapshot: { sellerSkus: [] },
    } as unknown as Parameters<typeof campaignProductReference>[0];

    expect(campaignProductReference(campaign, t, true)).toBe(
      "ecommerce.affiliateCampaign.productIdLabel · product-1",
    );
  });

  it("substitutes the SKU in a Sample review's product label", () => {
    const row = {
      productTitle: null,
      productSellerSku: "HL-TEE-RED-L",
      productId: "product-1",
    } as unknown as AffiliateSampleProposalReviewRow;

    expect(sampleReviewRowProductLabel(row, tf, false)).toBe(
      "ecommerce.affiliateWorkspace.sampleDecisionBundle.sellerSku HL-TEE-RED-L",
    );
    expect(sampleReviewRowProductLabel(row, tf, true)).toBe(
      "ecommerce.affiliateWorkspace.sampleDecisionBundle.sellerSku ••••",
    );
  });

  it("leaves a Sample review label that falls back to the opaque product id alone", () => {
    const row = {
      productTitle: null,
      productSellerSku: null,
      productId: "product-1",
    } as unknown as AffiliateSampleProposalReviewRow;

    expect(sampleReviewRowProductLabel(row, tf, true)).toBe("product-1");
  });

  it("marks the seller SKU rendered beside a product summary's variant rows", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/components/ProductSummaryCard.tsx"),
      "utf8",
    );

    // The row name falls back to the platform sku id, which is opaque and must
    // not be masked — so the sensitivity travels with the row, not the site.
    expect(source).toContain('<TkPrivate as="strong" sensitive={sku.sensitive}>');
    expect(source).toContain("sensitive: Boolean(sku.sellerSku)");
  });
});

describe("shop-label resolution", () => {
  it("resolves every ecommerce page's shop labels through the shared resolver", () => {
    for (const fileName of [
      "AffiliateCampaignPage.tsx",
      "AffiliateManagementPage.tsx",
      "CustomerServiceEscalationsPage.tsx",
      "ProductKnowledgePage.tsx",
    ]) {
      expect(pageSource(fileName)).toContain('from "../../lib/shop-display.js"');
    }
  });
});
