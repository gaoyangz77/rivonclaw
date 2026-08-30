export interface ActiveAffiliateRunCheckpoint {
  creatorRelationshipId: string;
  sessionKey: string;
  runId: string;
  baseCheckpointId: string | null;
  baseEventCursor: number;
  handledSignalAt: string | null;
  candidateCheckpointId: string;
  targetEventCursor: number;
  relationshipOperationalConfigRevision: number;
  /**
   * Immutable agenda snapshot the backend minted for this exact dispatch.
   * Null when the work item predates snapshot dispatch (old backend or old
   * rows); passed through on affiliate_resolve_work_item when present.
   */
  agendaItemsSnapshotId?: string | null;
  predictionCacheIds?: string[];
  terminalOutcome?: "RESOLVED" | "ESCALATED";
}

const activeAffiliateRunCheckpoints = new Map<string, ActiveAffiliateRunCheckpoint>();

export function registerActiveAffiliateRunCheckpoint(input: ActiveAffiliateRunCheckpoint): void {
  activeAffiliateRunCheckpoints.set(input.creatorRelationshipId, input);
}

export function unregisterActiveAffiliateRunCheckpoint(input: {
  creatorRelationshipId: string;
  runId: string;
}): void {
  const current = activeAffiliateRunCheckpoints.get(input.creatorRelationshipId);
  if (current?.runId === input.runId) {
    activeAffiliateRunCheckpoints.delete(input.creatorRelationshipId);
  }
}

export function getActiveAffiliateRunCheckpoint(
  creatorRelationshipId: string,
): ActiveAffiliateRunCheckpoint | null {
  return activeAffiliateRunCheckpoints.get(creatorRelationshipId) ?? null;
}

export function recordActiveAffiliateRunPredictionCacheIds(input: {
  creatorRelationshipId: string;
  cacheIds: readonly string[];
}): void {
  const checkpoint = activeAffiliateRunCheckpoints.get(input.creatorRelationshipId);
  if (!checkpoint) return;
  const merged = new Set(checkpoint.predictionCacheIds ?? []);
  for (const cacheId of input.cacheIds) {
    const normalized = cacheId.trim();
    if (normalized) merged.add(normalized);
  }
  checkpoint.predictionCacheIds = [...merged];
}

export function recordActiveAffiliateRunTerminalOutcome(input: {
  creatorRelationshipId: string;
  outcome: "RESOLVED" | "ESCALATED";
}): void {
  const checkpoint = activeAffiliateRunCheckpoints.get(input.creatorRelationshipId);
  if (!checkpoint) {
    throw new Error("No active Affiliate run exists for this terminal tool call");
  }
  if (checkpoint.terminalOutcome && checkpoint.terminalOutcome !== input.outcome) {
    throw new Error(
      `Affiliate run already completed with terminal outcome ${checkpoint.terminalOutcome}`,
    );
  }
  checkpoint.terminalOutcome = input.outcome;
}

export function assertAffiliateRunTerminalOutcomeAvailable(creatorRelationshipId: string): void {
  const checkpoint = activeAffiliateRunCheckpoints.get(creatorRelationshipId);
  if (!checkpoint) {
    throw new Error("No active Affiliate run exists for this terminal tool call");
  }
  if (checkpoint.terminalOutcome) {
    throw new Error(
      `Affiliate run already completed with terminal outcome ${checkpoint.terminalOutcome}`,
    );
  }
}

export function __clearActiveAffiliateRunCheckpointsForTests(): void {
  activeAffiliateRunCheckpoints.clear();
}
