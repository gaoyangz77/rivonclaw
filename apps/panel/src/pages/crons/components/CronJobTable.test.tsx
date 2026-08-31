// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CronJobTable } from "./CronJobTable.js";
import type { CronJob } from "../cron-utils.js";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "common.delete": "Delete",
        "common.edit": "Edit",
        "crons.colActions": "Actions",
        "crons.fieldEnabled": "Enabled",
        "crons.moreActions": "More",
        "crons.neverRun": "Never",
        "crons.runNow": "Run",
        "crons.viewHistory": "History",
      } as Record<string, string>)[key] ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const JOB: CronJob = {
  id: "daily-brief",
  name: "Daily brief",
  description: "Summarize the last 24 hours",
  enabled: true,
  createdAtMs: 1,
  updatedAtMs: 1,
  schedule: { kind: "cron", expr: "0 9 * * *", tz: "UTC" },
  sessionTarget: "isolated",
  wakeMode: "now",
  payload: { kind: "agentTurn", message: "Create the brief" },
  state: {},
};

describe("CronJobTable", () => {
  it("uses the row as the edit action without hijacking nested actions", () => {
    const onEdit = vi.fn();
    const onRun = vi.fn();
    const onHistory = vi.fn();

    render(
      <CronJobTable
        jobs={[JOB]}
        loading={false}
        now={Date.now()}
        runningJobId={null}
        onEdit={onEdit}
        onToggle={vi.fn()}
        onRun={onRun}
        onHistory={onHistory}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("row", { name: "Edit: Daily brief" }));
    expect(onEdit).toHaveBeenCalledWith(JOB);

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(onRun).toHaveBeenCalledWith(JOB.id);
    expect(onEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "History" }));
    expect(onHistory).toHaveBeenCalledWith(JOB);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
