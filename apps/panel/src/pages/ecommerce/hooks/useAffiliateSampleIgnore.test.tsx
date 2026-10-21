import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { print } from "graphql";
import {
  useAffiliateSampleIgnore,
  SAMPLE_IGNORE_WAIT_MS,
  SAMPLE_IGNORE_CHECK_MS,
  IGNORE_AFFILIATE_SAMPLE_MUTATION,
  AFFILIATE_SAMPLE_IGNORE_CONFIRMATION_QUERY,
} from "./useAffiliateSampleIgnore.js";

const { client } = vi.hoisted(() => ({ client: { mutate: vi.fn(), query: vi.fn() } }));
vi.mock("@apollo/client/react", () => ({ useApolloClient: () => client }));
const input: GQL.ReviewAffiliateSampleApplicationInput = {
  sampleApplicationRecordId: "sample-1",
  creatorRelationshipId: "relationship-1",
  projectionRevision: 4,
  reviewDispositionRevision: 1,
  decision: GQL.AffiliateSampleReviewDecision.Reject,
  executionMode: GQL.AffiliateSampleReviewExecutionMode.AllowPlatformExpiry,
  rejectReason: GQL.AffiliateSampleRejectReason.NotMatch,
};
const ignored = {
  id: "sample-1",
  projectionRevision: 4,
  reviewDispositionRevision: 2,
  reviewDisposition: GQL.AffiliateSampleReviewDisposition.SoftRejected,
};
const open = {
  ...ignored,
  reviewDispositionRevision: 1,
  reviewDisposition: GQL.AffiliateSampleReviewDisposition.Open,
};
const read = (
  sample: Pick<
    GQL.SampleApplicationRecord,
    "id" | "projectionRevision" | "reviewDispositionRevision" | "reviewDisposition"
  > = ignored,
) => ({
  data: { affiliateSampleApplicationState: { found: true, sampleApplication: sample } },
});
const saved = { data: { reviewAffiliateSampleApplication: { sampleApplication: ignored } } };
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("requests only persisted confirmation fields, with no row or display enrichment", () => {
  const mutation = print(IGNORE_AFFILIATE_SAMPLE_MUTATION);
  expect(mutation).toContain("reviewAffiliateSampleApplication");
  expect(mutation).not.toMatch(/productTitle|creatorGmv|merchantReviewActor\s*\{|proposal\s*\{/);
  expect(print(AFFILIATE_SAMPLE_IGNORE_CONFIRMATION_QUERY)).toContain(
    "affiliateSampleApplicationState",
  );
});

it("finishes immediately on a confirmed save without an extra read", async () => {
  client.mutate.mockResolvedValue(saved);
  const { result } = renderHook(() => useAffiliateSampleIgnore("sample-1"));
  await act(async () => {
    expect(await result.current.execute(input)).toBe("SAVED");
  });
  expect(result.current.busy).toBe(false);
  expect(client.query).not.toHaveBeenCalled();
});

it.each(["timeout", "lost response"])(
  "checks an ambiguous %s and recognizes an already committed Ignore",
  async (mode) => {
    client.mutate.mockImplementation(() =>
      mode === "timeout" ? new Promise(() => {}) : Promise.reject(new Error("network")),
    );
    client.query.mockResolvedValue(read());
    const { result } = renderHook(() => useAffiliateSampleIgnore("sample-1"));
    let pending!: ReturnType<typeof result.current.execute>;
    await act(async () => {
      pending = result.current.execute(input);
      await vi.advanceTimersByTimeAsync(SAMPLE_IGNORE_WAIT_MS);
    });
    expect(await pending).toBe("SAVED");
    expect(result.current.phase).toBe("idle");
    expect(client.mutate).toHaveBeenCalledOnce();
    expect(client.query).toHaveBeenCalledWith(
      expect.objectContaining({
        fetchPolicy: "network-only",
        context: expect.objectContaining({ queryDeduplication: false }),
        variables: {
          creatorRelationshipId: "relationship-1",
          sampleApplicationRecordId: "sample-1",
        },
      }),
    );
  },
);

it("keeps an unchanged read unconfirmed and rechecks without ever repeating the write", async () => {
  client.mutate.mockImplementation(() => new Promise(() => {}));
  client.query.mockResolvedValueOnce(read(open)).mockResolvedValueOnce(read());
  const { result } = renderHook(() => useAffiliateSampleIgnore("sample-1"));
  let pending!: ReturnType<typeof result.current.execute>;
  await act(async () => {
    pending = result.current.execute(input);
    await vi.advanceTimersByTimeAsync(SAMPLE_IGNORE_WAIT_MS);
  });
  expect(await pending).toBe("UNCONFIRMED");
  expect(result.current.phase).toBe("unconfirmed");
  expect(result.current.busy).toBe(false);
  await act(async () => {
    expect(await result.current.execute(input)).toBe("SAVED");
  });
  expect(client.mutate).toHaveBeenCalledOnce();
  expect(client.query).toHaveBeenCalledTimes(2);
});

it("bounds the verification read as well, rather than moving the endless spinner to checking", async () => {
  client.mutate.mockImplementation(() => new Promise(() => {}));
  client.query.mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useAffiliateSampleIgnore("sample-1"));
  let pending!: ReturnType<typeof result.current.execute>;
  await act(async () => {
    pending = result.current.execute(input);
    await vi.advanceTimersByTimeAsync(SAMPLE_IGNORE_WAIT_MS);
  });
  expect(result.current.phase).toBe("checking");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SAMPLE_IGNORE_CHECK_MS);
  });
  expect(await pending).toBe("UNCONFIRMED");
  expect(result.current.busy).toBe(false);
  expect(client.mutate).toHaveBeenCalledOnce();
});

it("reports a concurrent change rather than pretending this request succeeded", async () => {
  client.mutate.mockRejectedValue(new Error("review state changed"));
  client.query.mockResolvedValue(read({ ...open, reviewDispositionRevision: 3 }));
  const { result } = renderHook(() => useAffiliateSampleIgnore("sample-1"));
  await act(async () => {
    expect(await result.current.execute(input)).toBe("CHANGED");
  });
  expect(result.current.phase).toBe("idle");
});

it("does not let a late mutation completion replace the read-back uncertainty state", async () => {
  let complete!: (value: typeof saved) => void;
  client.mutate.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  client.query.mockResolvedValue(read(open));
  const { result } = renderHook(() => useAffiliateSampleIgnore("sample-1"));
  await act(async () => {
    void result.current.execute(input);
    await vi.advanceTimersByTimeAsync(SAMPLE_IGNORE_WAIT_MS);
  });
  await act(async () => {
    complete(saved);
  });
  expect(result.current.phase).toBe("unconfirmed");
  expect(client.mutate).toHaveBeenCalledOnce();
});

it("suppresses double clicks before React has rerendered", async () => {
  client.mutate.mockResolvedValue(saved);
  const { result } = renderHook(() => useAffiliateSampleIgnore("sample-1"));
  await act(async () => {
    const first = result.current.execute(input);
    expect(await result.current.execute(input)).toBe("CANCELLED");
    expect(await first).toBe("SAVED");
  });
  expect(client.mutate).toHaveBeenCalledOnce();
});

it("ignores a completion for a closed or different Creator modal", async () => {
  let complete!: (value: typeof saved) => void;
  client.mutate.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const { result, rerender } = renderHook(({ id }) => useAffiliateSampleIgnore(id), {
    initialProps: { id: "sample-1" },
  });
  let pending!: ReturnType<typeof result.current.execute>;
  act(() => {
    pending = result.current.execute(input);
  });
  rerender({ id: "sample-2" });
  await act(async () => {
    complete(saved);
    expect(await pending).toBe("CANCELLED");
  });
  expect(result.current.phase).toBe("idle");
  expect(client.query).not.toHaveBeenCalled();
});
