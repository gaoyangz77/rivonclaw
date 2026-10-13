import { ApolloClient, ApolloLink, InMemoryCache, Observable, gql } from "@apollo/client";
import { ApolloProvider, useQuery } from "@apollo/client/react";
import { act, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { campaignDetailPollingOptions } from "./AffiliateCampaignPage.js";

const QUERY = gql`
  query PollCampaignDetail {
    result {
      id
      status
    }
  }
`;

function Detail({ active = true, campaignId = "campaign-1" }) {
  const { data } = useQuery<{ result: { id: string; status: string } }>(QUERY, {
    skip: !campaignId,
    ...campaignDetailPollingOptions(active, campaignId),
  });
  return <span>{data?.result.status ?? "loading"}</span>;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Campaign detail refresh", () => {
  it("uses the same visible-only 15-second policy for all five detail queries", () => {
    expect(campaignDetailPollingOptions(true, "campaign-1").pollInterval).toBe(15_000);
    expect(campaignDetailPollingOptions(false, "campaign-1").pollInterval).toBe(0);
    expect(campaignDetailPollingOptions(true, "").pollInterval).toBe(0);
    const source = readFileSync(resolve(import.meta.dirname, "AffiliateCampaignPage.tsx"), "utf8");
    for (const query of [
      "summaryQuery",
      "screeningQuery",
      "creatorStatesQuery",
      "selectionReadinessQuery",
      "searchPlansQuery",
    ]) {
      const start = source.indexOf(`const ${query} = useQuery`);
      const options = source.slice(start, source.indexOf("\n  });", start) + 6);
      expect(options).toContain(
        "...campaignDetailPollingOptions(workspaceTab.active, selectedCampaignId)",
      );
    }
  });

  it("updates the mounted list without reopening and skips hidden-page polls", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    let requests = 0;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new ApolloLink(
        () =>
          new Observable((observer) => {
            requests++;
            observer.next({
              data: {
                result: { id: "creator-1", status: requests === 1 ? "SCHEDULED" : "REACHED_OUT" },
              },
            });
            observer.complete();
          }),
      ),
    });
    const view = render(
      <ApolloProvider client={client}>
        <Detail />
      </ApolloProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByText("SCHEDULED")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(screen.getByText("REACHED_OUT")).toBeTruthy();
    expect(requests).toBe(2);
    visibility.mockReturnValue("hidden");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(requests).toBe(2);
    visibility.mockReturnValue("visible");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(requests).toBe(3);
    view.rerender(
      <ApolloProvider client={client}>
        <Detail active={false} />
      </ApolloProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(requests).toBe(3);
    view.unmount();
    client.stop();
  });
});
