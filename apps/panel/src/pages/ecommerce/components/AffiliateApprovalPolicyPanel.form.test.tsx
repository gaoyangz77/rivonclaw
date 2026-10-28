// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { ToastProvider } from "../../../components/Toast.js";
import {
  AFFILIATE_APPROVAL_POLICIES_QUERY,
  AFFILIATE_POLICY_CONTEXT_QUERY,
  CREATOR_MANUAL_TAGS_QUERY,
  WRITE_AFFILIATE_APPROVAL_POLICY_MUTATION,
} from "../../../api/shops-queries.js";
import {
  AffiliateApprovalPolicyPanel,
  AffiliatePolicyForm,
  buildPolicyConditionSummary,
  isGlobalPolicy,
  policyToForm,
} from "./AffiliateApprovalPolicyPanel.js";

afterEach(cleanup);

function policy(overrides: Partial<GQL.AffiliateApprovalPolicy> = {}): GQL.AffiliateApprovalPolicy {
  return {
    id: "policy",
    userId: "seller",
    action: GQL.ActionProposalType.ReviewSampleApplication,
    enabled: true,
    manualTagIds: [],
    excludedManualTagIds: [],
    sampleTiers: [],
    excludedSampleTiers: [],
    campaignIds: [],
    productIds: [],
    sampleReviewDecisions: [],
    reason: "Review samples",
    createdAt: "2026-10-27T00:00:00Z",
    updatedAt: "2026-10-27T00:00:00Z",
    ...overrides,
  };
}

const key = (name: string) => `ecommerce.affiliateWorkspace.policies.${name}`;
function formProps(source = policy()) {
  return {
    form: policyToForm(source),
    saving: false,
    onChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    actionOptions: [
      { value: GQL.ActionProposalType.ReviewSampleApplication, label: "Sample review" },
      { value: GQL.ActionProposalType.SendMessage, label: "Send message" },
    ],
    campaignOptions: [],
    manualTagOptions: [],
    sampleTierOptions: [],
  };
}

describe("sample review policy editor", () => {
  it("round-trips all/approve/reject conditions, clears them on action changes, and disables while saving", async () => {
    await i18n.changeLanguage("zh");
    const props = formProps();
    const view = render(<AffiliatePolicyForm {...props} />);
    const picker = () =>
      screen.getByRole("button", { name: i18n.t(key("sampleReviewDecisionsLabel")) });
    expect(picker().textContent).toContain(i18n.t(key("sampleReviewAllResults")));
    for (const [label, decision] of [
      ["sampleReviewApproveOnly", GQL.AffiliateSampleReviewDecision.Approve],
      ["sampleReviewRejectOnly", GQL.AffiliateSampleReviewDecision.Reject],
    ] as const) {
      fireEvent.click(picker());
      fireEvent.click(screen.getByRole("button", { name: i18n.t(key(label)) }));
      expect(props.onChange).toHaveBeenLastCalledWith({
        ...props.form,
        sampleReviewDecisions: [decision],
      });
    }
    const selected = {
      ...props.form,
      sampleReviewDecisions: [GQL.AffiliateSampleReviewDecision.Approve],
    };
    view.rerender(<AffiliatePolicyForm {...props} form={selected} />);
    expect(picker().textContent).toContain(i18n.t(key("sampleReviewApproveOnly")));
    fireEvent.click(picker());
    fireEvent.click(screen.getByRole("button", { name: i18n.t(key("sampleReviewAllResults")) }));
    expect(props.onChange).toHaveBeenLastCalledWith({ ...selected, sampleReviewDecisions: [] });
    fireEvent.click(screen.getByRole("button", { name: i18n.t(key("actionLabel")) }));
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(props.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: GQL.ActionProposalType.SendMessage,
        sampleReviewDecisions: [],
      }),
    );
    view.rerender(
      <AffiliatePolicyForm
        {...props}
        form={{ ...selected, action: GQL.ActionProposalType.SendMessage }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: i18n.t(key("sampleReviewDecisionsLabel")) }),
    ).toBeNull();
    view.rerender(<AffiliatePolicyForm {...props} saving />);
    expect(picker()).toHaveProperty("disabled", true);
  });

  it("keeps legacy/both-result policies global and labels conditional policies accurately", () => {
    const legacy = policy({ sampleReviewDecisions: undefined as never });
    expect(policyToForm(legacy).sampleReviewDecisions).toEqual([]);
    expect(isGlobalPolicy(legacy)).toBe(true);
    expect(
      isGlobalPolicy(
        policy({ sampleReviewDecisions: Object.values(GQL.AffiliateSampleReviewDecision) }),
      ),
    ).toBe(true);
    const t = i18n.getFixedT("en");
    for (const [decision, label] of [
      [GQL.AffiliateSampleReviewDecision.Approve, "sampleReviewApproveOnly"],
      [GQL.AffiliateSampleReviewDecision.Reject, "sampleReviewRejectOnly"],
    ] as const) {
      const source = policy({ sampleReviewDecisions: [decision] });
      expect(policyToForm(source).sampleReviewDecisions).toEqual([decision]);
      expect(isGlobalPolicy(source)).toBe(false);
      expect(buildPolicyConditionSummary(t, source, [], []).title).toBe(t(key(label)));
    }
  });

  it.each(["en", "zh", "de", "es", "fr", "id", "it", "th"])(
    "renders translated result choices and guidance in %s",
    async (language) => {
      await i18n.changeLanguage(language);
      render(<AffiliatePolicyForm {...formProps()} />);
      for (const name of [
        "sampleReviewDecisionsLabel",
        "sampleReviewAllResults",
        "sampleReviewApproveOnly",
        "sampleReviewRejectOnly",
        "sampleReviewDecisionsHint",
      ]) {
        expect(i18n.exists(key(name), { lng: language })).toBe(true);
      }
      expect(screen.getByText(i18n.t(key("sampleReviewDecisionsHint")))).toBeTruthy();
      fireEvent.click(
        screen.getByRole("button", { name: i18n.t(key("sampleReviewDecisionsLabel")) }),
      );
      expect(
        screen.getByRole("button", { name: i18n.t(key("sampleReviewApproveOnly")) }),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: i18n.t(key("sampleReviewRejectOnly")) }),
      ).toBeTruthy();
    },
  );

  it.each(["create", "edit", "toggle"] as const)(
    "persists the result filter through %s and reload",
    async (mode) => {
      await i18n.changeLanguage("en");
      const source = policy({ sampleReviewDecisions: [GQL.AffiliateSampleReviewDecision.Approve] });
      const saved = { ...source, enabled: mode !== "toggle" };
      const write = vi.fn((_variables: Record<string, unknown>) => ({
        data: { writeAffiliateApprovalPolicy: saved },
      }));
      const read = vi
        .fn()
        .mockReturnValueOnce({
          data: { affiliateApprovalPolicies: mode === "create" ? [] : [source] },
        })
        .mockReturnValue({ data: { affiliateApprovalPolicies: [saved] } });
      render(
        <MockedProvider
          mocks={[
            {
              request: { query: AFFILIATE_APPROVAL_POLICIES_QUERY, variables: { input: {} } },
              maxUsageCount: 2,
              result: read,
            },
            {
              request: { query: AFFILIATE_POLICY_CONTEXT_QUERY },
              result: { data: { affiliateApprovalPolicyContext: { shops: [] } } },
            },
            {
              request: { query: CREATOR_MANUAL_TAGS_QUERY, variables: { input: {} } },
              result: { data: { creatorManualTags: [] } },
            },
            {
              request: { query: WRITE_AFFILIATE_APPROVAL_POLICY_MUTATION, variables: () => true },
              result: write,
            },
          ]}
        >
          <ToastProvider>
            <AffiliateApprovalPolicyPanel />
          </ToastProvider>
        </MockedProvider>,
      );
      await screen.findByRole("tab", { name: /Review sample application/i });
      if (mode === "create") {
        fireEvent.click(screen.getByRole("button", { name: "Create policy" }));
        fireEvent.click(screen.getByRole("button", { name: i18n.t(key("actionLabel")) }));
        fireEvent.click(screen.getByRole("button", { name: "Review sample application" }));
        fireEvent.click(
          screen.getByRole("button", { name: i18n.t(key("sampleReviewDecisionsLabel")) }),
        );
        fireEvent.click(
          screen.getByRole("button", { name: i18n.t(key("sampleReviewApproveOnly")) }),
        );
        fireEvent.click(screen.getByRole("button", { name: "Save policy" }));
      } else {
        fireEvent.click(screen.getByRole("tab", { name: /Review sample application/i }));
        fireEvent.click(
          await screen.findByRole("button", { name: mode === "toggle" ? "Disable" : "Edit" }),
        );
        if (mode === "edit") {
          expect(
            screen.getByRole("button", { name: i18n.t(key("sampleReviewDecisionsLabel")) })
              .textContent,
          ).toContain(i18n.t(key("sampleReviewApproveOnly")));
          fireEvent.click(screen.getByRole("button", { name: "Save policy" }));
        }
      }
      await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
      expect(write.mock.calls[0]?.[0]).toMatchObject({
        input: {
          action: GQL.ActionProposalType.ReviewSampleApplication,
          enabled: mode !== "toggle",
          sampleReviewDecisions: [GQL.AffiliateSampleReviewDecision.Approve],
        },
      });
      await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
      fireEvent.click(screen.getByRole("tab", { name: /Review sample application/i }));
      expect(screen.getByText(i18n.t(key("sampleReviewApproveOnly")))).toBeTruthy();
    },
  );
});
