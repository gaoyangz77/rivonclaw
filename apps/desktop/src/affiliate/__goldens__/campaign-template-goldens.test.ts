/**
 * Golden generator for the Campaign first-touch template one-shot (ADR-123
 * decision 6, docs/SERVICES/agent-runner.md "Parity goldens").
 *
 * It drives the real `generateCampaignMessageTemplate()` and the real
 * `runStructuredOneShotAgent()` against a fake gateway runtime, and records the
 * exact `agent` request each model turn is sent. That is the text the model
 * actually receives: `modelRun` clears the provider system prompt, so every
 * instruction travels in `message` (ADR-107). Recording only the builder's
 * `systemPrompt` would miss the output contract the one-shot wrapper prepends.
 *
 * AGENT_GOLDENS_OUT=<dir> writes <dir>/one-shot/<case>.json (requires
 * AGENT_GOLDENS_SOURCE_COMMIT). Otherwise the test asserts regeneration is
 * stable against the goldens checked into the server repo, when present.
 *
 * All data below is synthetic: the root repository is public.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  runStructuredOneShotAgent,
  type StructuredOneShotAgentRuntime,
} from "../../gateway/structured-one-shot-agent.js";
import {
  generateCampaignMessageTemplate,
  type StructuredRunner,
} from "../affiliate-campaign-ai-service.js";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = "apps/desktop/src/affiliate/affiliate-campaign-ai-service.ts";
const COMMITTED_DIR = resolve(
  here,
  "../../../../../server/backend/test-fixtures/agent-goldens/one-shot",
);

const NOTE = "Brightloom sells everyday jewelry.\n\nThis pendant is a gold-tone faith piece.";
const VALID_MODEL_OUTPUT = JSON.stringify({
  text: "Hi {{creator_name}}, we'd love to share this pendant with you.",
  productShortName: "faith pendant",
  collaborationInvitationText: NOTE,
});
const INVALID_MODEL_OUTPUT = JSON.stringify({
  text: "Hi [Name], we'd love to share this pendant with you.",
  productShortName: "faith pendant",
  collaborationInvitationText: NOTE,
});

interface ProductPreview {
  productId: string;
  title: string;
  description?: string | null;
  status?: string | null;
  originalCurrency: string;
  minimumPriceUsdAmount: number;
  maximumPriceUsdAmount: number;
  categoryPathIds: string[];
  categoryPathNames: string[];
  brandId?: string | null;
  brandName?: string | null;
  observedAt: string;
  snapshotHash: string;
}

interface CaseInput {
  shopId: string;
  shopName: string | null;
  uiLocale: string;
  guidance?: string;
  mode: "INITIAL" | "ALTERNATIVE";
  previousDraft?: string;
  previousInvitationText?: string;
  product: ProductPreview;
  /** Raw model replies, one per turn. A second entry exercises the repair turn. */
  modelReplies: string[];
}

const FULL_PRODUCT: ProductPreview = {
  productId: "product-1",
  title: "Very Long Marketplace Product Title Gold Tone Pendant Necklace 2026 New",
  description: "A gold-tone faith-inspired pendant for everyday outfits.",
  status: "ACTIVE",
  originalCurrency: "USD",
  minimumPriceUsdAmount: 19.99,
  maximumPriceUsdAmount: 24.99,
  categoryPathIds: ["jewelry", "necklaces"],
  categoryPathNames: ["Jewelry", "Necklaces"],
  brandId: "brand-1",
  brandName: "Brightloom",
  observedAt: "2026-07-26T00:00:00.000Z",
  snapshotHash: "product-hash-1",
};

const BARE_PRODUCT: ProductPreview = {
  productId: "product-2",
  title: "Wellness Tonic",
  description: null,
  status: null,
  originalCurrency: "MXN",
  minimumPriceUsdAmount: 10,
  maximumPriceUsdAmount: 10,
  categoryPathIds: [],
  categoryPathNames: [],
  brandId: null,
  brandName: null,
  observedAt: "2026-09-24T00:00:00.000Z",
  snapshotHash: "product-hash-2",
};

// A key the GraphQL layer omitted entirely (as opposed to returning null) is
// dropped by JSON.stringify, so it serializes differently from `null`.
const { description: _omittedDescription, brandName: _omittedBrand, ...PRODUCT_WITH_ABSENT_KEYS } =
  FULL_PRODUCT;

const CASES: Record<string, CaseInput> = {
  "initial-full-product-shop-known": {
    shopId: "shop-5",
    shopName: "Brightloom",
    uiLocale: "zh-CN",
    mode: "INITIAL",
    product: FULL_PRODUCT,
    modelReplies: [VALID_MODEL_OUTPUT],
  },
  "initial-bare-product-shop-unknown": {
    shopId: "shop-5",
    shopName: null,
    uiLocale: "en",
    mode: "INITIAL",
    product: BARE_PRODUCT,
    modelReplies: [VALID_MODEL_OUTPUT],
  },
  "initial-absent-product-keys": {
    shopId: "shop-5",
    shopName: "Brightloom",
    uiLocale: "de",
    mode: "INITIAL",
    product: PRODUCT_WITH_ABSENT_KEYS as ProductPreview,
    modelReplies: [VALID_MODEL_OUTPUT],
  },
  "initial-guidance-present": {
    shopId: "shop-5",
    shopName: "Brightloom",
    uiLocale: "es-MX",
    guidance: "  Mention   the\n gift-box angle,\tkeep it short.  ",
    mode: "INITIAL",
    product: FULL_PRODUCT,
    modelReplies: [VALID_MODEL_OUTPUT],
  },
  "initial-guidance-blank": {
    shopId: "shop-5",
    shopName: "Brightloom",
    uiLocale: "th",
    guidance: "   \n\t ",
    mode: "INITIAL",
    product: FULL_PRODUCT,
    modelReplies: [VALID_MODEL_OUTPUT],
  },
  "initial-guidance-compat-characters": {
    shopId: "shop-5",
    shopName: "Brightloom",
    uiLocale: "ja",
    guidance: "ＡＢＣ　全角スペース　１２３ ½",
    mode: "INITIAL",
    product: FULL_PRODUCT,
    modelReplies: [VALID_MODEL_OUTPUT],
  },
  "initial-ignores-previous-fields": {
    shopId: "shop-5",
    shopName: "Brightloom",
    uiLocale: "fr",
    mode: "INITIAL",
    previousDraft: "Old draft {{creator_name}}",
    previousInvitationText: "Old note\nsecond line",
    product: FULL_PRODUCT,
    modelReplies: [VALID_MODEL_OUTPUT],
  },
  "alternative-with-previous": {
    shopId: "shop-5",
    shopName: "Brightloom",
    uiLocale: "it",
    guidance: "Lean into the gift angle",
    mode: "ALTERNATIVE",
    previousDraft: "  Hi {{creator_name}},\n  we love   your style.  ",
    previousInvitationText: "Old note\nsecond line\n\n\nthird",
    product: FULL_PRODUCT,
    modelReplies: [VALID_MODEL_OUTPUT],
  },
  "alternative-without-previous": {
    shopId: "shop-5",
    shopName: null,
    uiLocale: "id",
    mode: "ALTERNATIVE",
    product: BARE_PRODUCT,
    modelReplies: [VALID_MODEL_OUTPUT],
  },
  "alternative-blank-previous": {
    shopId: "shop-5",
    shopName: "Brightloom",
    uiLocale: "en-GB",
    mode: "ALTERNATIVE",
    previousDraft: "   ",
    previousInvitationText: "\n\n",
    product: FULL_PRODUCT,
    modelReplies: [VALID_MODEL_OUTPUT],
  },
  "repair-turn-after-missing-creator-placeholder": {
    shopId: "shop-5",
    shopName: "Brightloom",
    uiLocale: "es-MX",
    guidance: "Keep it warm",
    mode: "ALTERNATIVE",
    previousDraft: "Hola {{creator_name}}",
    previousInvitationText: "Nota anterior",
    product: FULL_PRODUCT,
    modelReplies: [INVALID_MODEL_OUTPUT, VALID_MODEL_OUTPUT],
  },
};

interface RecordedTurn {
  /** The complete text the model receives. `modelRun` sends no system prompt. */
  message: string;
  modelRun: unknown;
  promptMode: unknown;
  deliver: unknown;
  hasExtraSystemPrompt: boolean;
}

async function recordTurns(input: CaseInput): Promise<RecordedTurn[]> {
  const turns: RecordedTurn[] = [];
  const replies = [...input.modelReplies];
  const runtime: StructuredOneShotAgentRuntime = {
    resolveDefaultModel: () => ({ provider: "golden-provider", model: "golden-model" }),
    async start(request) {
      turns.push({
        message: String(request.message),
        modelRun: request.modelRun,
        promptMode: request.promptMode,
        deliver: request.deliver,
        hasExtraSystemPrompt: "extraSystemPrompt" in request,
      });
      return { runId: `run-${turns.length}` };
    },
    async wait() {
      const reply = replies.shift();
      if (reply === undefined) throw new Error("golden case ran out of scripted model replies");
      return { status: "ok", terminalReply: { disposition: "visible", text: reply } };
    },
    async history() {
      return { messages: [] };
    },
    async deleteSession() {},
  };
  const runStructured: StructuredRunner = (options) => runStructuredOneShotAgent(options, runtime);
  const validated = {
    text: "Hi {{creator_name}}, we'd love to share this pendant with you.",
    productShortName: "faith pendant",
    collaborationInvitationText: NOTE,
    source: "AI_GENERATED" as const,
  };
  await generateCampaignMessageTemplate({
    authSession: {
      graphqlFetch: async (query: string) => {
        if (query.includes("AffiliateCampaignMessageProductPreview")) {
          return { affiliateCampaignProductPreview: input.product };
        }
        return { validateAffiliateCampaignMessageTemplateSuggestion: validated };
      },
    } as never,
    shopId: input.shopId,
    productId: input.product.productId,
    uiLocale: input.uiLocale,
    guidance: input.guidance,
    mode: input.mode,
    previousDraft: input.previousDraft,
    previousInvitationText: input.previousInvitationText,
    runStructured,
    resolveShopName: () => input.shopName,
  });
  expect(replies).toEqual([]);
  return turns;
}

async function buildGolden(caseId: string, sourceCommit: string) {
  const input = CASES[caseId]!;
  return {
    schemaVersion: 1,
    source: { repo: "root", commit: sourceCommit, file: SOURCE_FILE },
    case: caseId,
    input,
    output: { turns: await recordTurns(input) },
  };
}

describe("campaign template one-shot goldens", () => {
  it("records what the model receives on every turn", async () => {
    const out = process.env.AGENT_GOLDENS_OUT;
    if (out) {
      const sourceCommit = process.env.AGENT_GOLDENS_SOURCE_COMMIT;
      if (!sourceCommit) throw new Error("AGENT_GOLDENS_SOURCE_COMMIT is required to write goldens");
      const dir = resolve(out, "one-shot");
      mkdirSync(dir, { recursive: true });
      for (const caseId of Object.keys(CASES)) {
        const golden = await buildGolden(caseId, sourceCommit);
        writeFileSync(resolve(dir, `campaign-template.${caseId}.json`), `${JSON.stringify(golden, null, 2)}\n`);
      }
      return;
    }
    if (!existsSync(COMMITTED_DIR)) return;
    for (const caseId of Object.keys(CASES)) {
      const file = resolve(COMMITTED_DIR, `campaign-template.${caseId}.json`);
      if (!existsSync(file)) continue;
      const committed = JSON.parse(readFileSync(file, "utf8")) as { source: { commit: string } };
      const regenerated = await buildGolden(caseId, committed.source.commit);
      expect(regenerated).toEqual(committed);
    }
  });

  it("sends every instruction in the message and no system prompt", async () => {
    const turns = await recordTurns(CASES["initial-full-product-shop-known"]!);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ modelRun: true, promptMode: "raw", deliver: false, hasExtraSystemPrompt: false });
    expect(turns[0]!.message).toContain("immutable protocol syntax");
    expect(turns[0]!.message).toContain("JSON Schema: ");
  });
});
