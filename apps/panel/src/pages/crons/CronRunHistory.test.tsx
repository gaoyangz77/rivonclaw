// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CronRunHistory } from "./CronRunHistory.js";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (key: string) => (key === "crons.loadMore" ? "Load more" : key),
  }),
}));

afterEach(cleanup);

describe("CronRunHistory pagination", () => {
  it("uses the server nextOffset instead of deriving it from the rendered row count", async () => {
    const fetchRuns = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [{ ts: 1, status: "ok" }],
        total: 40,
        offset: 0,
        limit: 20,
        hasMore: true,
        nextOffset: 20,
      })
      .mockResolvedValueOnce({
        entries: [{ ts: 21, status: "ok" }],
        total: 40,
        offset: 20,
        limit: 20,
        hasMore: false,
        nextOffset: null,
      });

    render(
      <CronRunHistory jobId="job-1" jobName="Daily sync" fetchRuns={fetchRuns} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(fetchRuns).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole("button", { name: /load more/i }));
    await waitFor(() => expect(fetchRuns).toHaveBeenCalledTimes(2));

    expect(fetchRuns.mock.calls[1]?.[0]).toMatchObject({ offset: 20 });
  });
});
