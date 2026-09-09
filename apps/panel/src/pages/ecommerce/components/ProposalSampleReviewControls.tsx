import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { TkBadge, TkInfoTip, TkSegmented, TkSwitchControl } from "../../../components/design-system/index.js";
import "./ProposalSampleReviewControls.css";

export type ProposalSampleReviewSubmission = Pick<GQL.DecideActionProposalInput, "sampleReviews" | "confirmRelatedMessages">;
type Disposition = "APPROVE" | "REJECT" | "IGNORE";
type ReviewRow = {
  sampleApplicationRecordId: string | null;
  decision: GQL.AffiliateSampleReviewDecision;
  executionMode: GQL.AffiliateSampleReviewExecutionMode;
};
const dispositions: Disposition[] = ["APPROVE", "REJECT", "IGNORE"];
const labelKeys = { APPROVE: "approveSample", REJECT: "platformReject", IGNORE: "softReject" };
export function sampleDisposition(row: Pick<ReviewRow, "decision" | "executionMode">): Disposition {
  return row.executionMode === GQL.AffiliateSampleReviewExecutionMode.AllowPlatformExpiry
    ? "IGNORE" : row.decision === GQL.AffiliateSampleReviewDecision.Approve ? "APPROVE" : "REJECT";
}

/** UI drafts contain primitive choices only; the proposal remains authoritative. */
export function useProposalSampleReview(proposal: GQL.ActionProposal, rows: ReviewRow[], editable: boolean, disabled: boolean) {
  const { t } = useTranslation();
  const scope = `${proposal.id}:${proposal.updatedAt}:${rows.map((row) => `${row.sampleApplicationRecordId}:${sampleDisposition(row)}`).join(",")}`;
  const [draft, setDraft] = useState<{ scope: string; choices: Record<string, Disposition>; confirmed: boolean }>({ scope, choices: {}, confirmed: false });
  const choices = draft.scope === scope ? draft.choices : {};
  const confirmed = draft.scope === scope && draft.confirmed;
  const actionTypes = proposal.steps?.length ? proposal.steps.map((step) => step.type) : [proposal.type];
  const supported = rows.length > 0 && rows.every((row) => Boolean(row.sampleApplicationRecordId)) &&
    actionTypes.every((type) => type === GQL.ActionProposalType.ReviewSampleApplication || type === GQL.ActionProposalType.SendMessage);
  const canEdit = editable && supported;
  const finalChoices = rows.map((row) => {
    const disposition = choices[row.sampleApplicationRecordId ?? ""] ?? sampleDisposition(row);
    return {
      sampleApplicationRecordId: row.sampleApplicationRecordId!,
      decision: disposition === "APPROVE" ? GQL.AffiliateSampleReviewDecision.Approve : GQL.AffiliateSampleReviewDecision.Reject,
      executionMode: disposition === "IGNORE" ? GQL.AffiliateSampleReviewExecutionMode.AllowPlatformExpiry : GQL.AffiliateSampleReviewExecutionMode.PlatformAction,
    };
  });
  const changed = finalChoices.some((choice, index) => sampleDisposition(choice) !== sampleDisposition(rows[index]));
  const needsMessageConfirmation = canEdit && changed && actionTypes.includes(GQL.ActionProposalType.SendMessage);
  return {
    canEdit,
    needsConfirmation: needsMessageConfirmation && !confirmed,
    submission: canEdit ? { sampleReviews: finalChoices, confirmRelatedMessages: confirmed } satisfies ProposalSampleReviewSubmission : undefined,
    messageConfirmation: needsMessageConfirmation ? (
      <div className="affiliate-proposal-message-confirmation" onClick={(event) => event.stopPropagation()}>
        <p>{t("ecommerce.affiliateWorkspace.sampleProposalReview.messageWarning")}</p>
        <div className="affiliate-proposal-message-confirmation-control">
          <TkSwitchControl label={t("ecommerce.affiliateWorkspace.sampleProposalReview.confirmMessages")} checked={confirmed} disabled={disabled}
            onChange={(value) => setDraft({ scope, choices, confirmed: value })} />
          <span>{t("ecommerce.affiliateWorkspace.sampleProposalReview.confirmMessages")}</span>
        </div>
      </div>
    ) : null,
    renderRow: (row: ReviewRow) => {
      const stored = proposal.decision?.sampleReviews?.find((choice) => choice.sampleApplicationRecordId === row.sampleApplicationRecordId);
      if (!canEdit && !stored) return null;
      const selected = stored ? sampleDisposition(stored) : choices[row.sampleApplicationRecordId!] ?? sampleDisposition(row);
      return (
        <div className="affiliate-proposal-final-disposition" onClick={(event) => event.stopPropagation()}>
          <span>{t("ecommerce.affiliateWorkspace.sampleProposalReview.finalDisposition")}</span>
          {canEdit ? (
            <TkSegmented size="sm" label={t("ecommerce.affiliateWorkspace.sampleProposalReview.finalDisposition")}
              value={selected} items={dispositions.map((id) => ({ id, label: t(`ecommerce.affiliateWorkspace.workbench.${labelKeys[id]}`), disabled }))}
              onChange={(value) => setDraft({ scope, choices: { ...choices, [row.sampleApplicationRecordId!]: value as Disposition }, confirmed: false })} />
          ) : (
            <TkBadge tone={selected === "APPROVE" ? "success" : selected === "REJECT" ? "danger" : "neutral"}>
              {t(`ecommerce.affiliateWorkspace.workbench.${labelKeys[selected]}`)}
            </TkBadge>
          )}
          <TkInfoTip label={t("ecommerce.affiliateWorkspace.workbench.reviewDescriptions.SOFT_REJECT")} />
        </div>
      );
    },
  };
}
