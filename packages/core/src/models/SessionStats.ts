import { types, type Instance } from "mobx-state-tree";

export const SessionStatsModel = types.model("SessionStats", {
  activeSessions: types.integer,
  totalSessions: types.integer,
  balance: types.integer,
  balanceExpiresAt: types.maybeNull(types.string),
});

export interface SessionStats extends Instance<typeof SessionStatsModel> {}
