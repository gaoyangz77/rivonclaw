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
  businessDeveloperIdSnapshot: string | null;
  businessDeveloperConfigRevision: number | null;
  predictionCacheIds?: string[];
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

export function __clearActiveAffiliateRunCheckpointsForTests(): void {
  activeAffiliateRunCheckpoints.clear();
}
