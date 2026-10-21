import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { GQL } from "@rivonclaw/core";

// No workbench row, product catalog, metrics, or reviewer-display enrichment.
const REVIEW_STATE_FIELDS = gql`
  fragment AffiliateIgnoreConfirmation on SampleApplicationRecord {
    id
    creatorRelationshipId
    projectionRevision
    reviewDisposition
    reviewDispositionRevision
    merchantReviewDecision
    merchantReviewExecutionMode
    merchantReviewRejectReason
    merchantReviewRejectReasonExplanation
    merchantReviewNote
    merchantReviewDecidedAt
    merchantReviewActorType
  }
`;
export const IGNORE_AFFILIATE_SAMPLE_MUTATION = gql`
  mutation IgnoreAffiliateSample($input: ReviewAffiliateSampleApplicationInput!) {
    reviewAffiliateSampleApplication(input: $input) {
      sampleApplication { ...AffiliateIgnoreConfirmation }
    }
  }
  ${REVIEW_STATE_FIELDS}
`;
export const AFFILIATE_SAMPLE_IGNORE_CONFIRMATION_QUERY = gql`
  query AffiliateSampleIgnoreConfirmation($creatorRelationshipId: ID!, $sampleApplicationRecordId: ID!) {
    affiliateSampleApplicationState(
      creatorRelationshipId: $creatorRelationshipId
      sampleApplicationRecordId: $sampleApplicationRecordId
    ) {
      found
      sampleApplication { ...AffiliateIgnoreConfirmation }
    }
  }
  ${REVIEW_STATE_FIELDS}
`;

export const SAMPLE_IGNORE_WAIT_MS = 20_000;
export const SAMPLE_IGNORE_CHECK_MS = 8_000;
type Phase = "idle" | "saving" | "checking" | "unconfirmed";
type Result = "SAVED" | "CHANGED" | "UNCONFIRMED" | "CANCELLED";
type SampleState = Pick<
  GQL.SampleApplicationRecord,
  "id" | "projectionRevision" | "reviewDisposition" | "reviewDispositionRevision"
>;

async function bounded<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Sample Ignore response deadline reached"));
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

function outcome(
  sample: SampleState | null | undefined,
  input: GQL.ReviewAffiliateSampleApplicationInput,
): Result {
  if (!sample || sample.id !== input.sampleApplicationRecordId) return "UNCONFIRMED";
  if (
    sample.reviewDispositionRevision > input.reviewDispositionRevision &&
    sample.reviewDisposition === GQL.AffiliateSampleReviewDisposition.SoftRejected
  )
    return "SAVED";
  if (
    sample.reviewDispositionRevision !== input.reviewDispositionRevision ||
    sample.projectionRevision !== input.projectionRevision
  )
    return "CHANGED";
  // An unchanged read does not prove the still-running write failed.
  return "UNCONFIRMED";
}

/** One write, then read-only confirmation on ambiguity. Never automatically resubmit. */
export function useAffiliateSampleIgnore(selectedSampleId?: string) {
  const client = useApolloClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const pending = useRef<GQL.ReviewAffiliateSampleApplicationInput | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    pending.current = null;
    busy.current = false;
    setPhase("idle");
    return () => {
      generation.current += 1;
    };
  }, [selectedSampleId]);

  async function check(
    input: GQL.ReviewAffiliateSampleApplicationInput,
    revision: number,
  ): Promise<Result> {
    if (generation.current !== revision) return "CANCELLED";
    setPhase("checking");
    let result: Result = "UNCONFIRMED";
    try {
      const response = await bounded(
        (signal) =>
          client.query<{
            affiliateSampleApplicationState: {
              found: boolean;
              sampleApplication: SampleState | null;
            };
          }>({
            query: AFFILIATE_SAMPLE_IGNORE_CONFIRMATION_QUERY,
            variables: {
              creatorRelationshipId: input.creatorRelationshipId,
              sampleApplicationRecordId: input.sampleApplicationRecordId,
            },
            fetchPolicy: "network-only",
            context: { queryDeduplication: false, fetchOptions: { signal } },
          }),
        SAMPLE_IGNORE_CHECK_MS,
      );
      result = outcome(response.data?.affiliateSampleApplicationState.sampleApplication, input);
    } catch {
      // This is the UI uncertainty boundary, not a failed business decision.
      // The next attempt is a READ; no exception can trigger a second write.
    }
    if (generation.current !== revision) return "CANCELLED";
    setPhase(result === "UNCONFIRMED" ? "unconfirmed" : "idle");
    if (result !== "UNCONFIRMED") pending.current = null;
    return result;
  }

  async function execute(input: GQL.ReviewAffiliateSampleApplicationInput): Promise<Result> {
    if (busy.current) return "CANCELLED";
    // Re-entering an unresolved operation can only check, never submit again.
    if (pending.current) return recheck();
    const revision = generation.current;
    pending.current = { ...input };
    busy.current = true;
    setPhase("saving");
    try {
      try {
        const response = await bounded(
          (signal) =>
            client.mutate<{
              reviewAffiliateSampleApplication: { sampleApplication: SampleState };
            }>({
              mutation: IGNORE_AFFILIATE_SAMPLE_MUTATION,
              variables: { input },
              context: { fetchOptions: { signal } },
            }),
          SAMPLE_IGNORE_WAIT_MS,
        );
        if (generation.current !== revision) return "CANCELLED";
        const result = outcome(
          response.data?.reviewAffiliateSampleApplication.sampleApplication,
          input,
        );
        if (result === "SAVED") {
          pending.current = null;
          setPhase("idle");
          return result;
        }
      } catch {
        // A lost response (or an error after a committed write) is ambiguous.
      }
      return await check(input, revision);
    } finally {
      if (generation.current === revision) busy.current = false;
    }
  }

  async function recheck(): Promise<Result> {
    if (busy.current || !pending.current) return "CANCELLED";
    const revision = generation.current;
    const input = { ...pending.current };
    busy.current = true;
    try {
      return await check(input, revision);
    } finally {
      if (generation.current === revision) busy.current = false;
    }
  }

  return { execute, recheck, phase, busy: phase === "saving" || phase === "checking" };
}
