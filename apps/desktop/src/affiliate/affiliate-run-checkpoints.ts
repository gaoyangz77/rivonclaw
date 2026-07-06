export interface ActiveAffiliateRunCheckpoint {
  creatorRelationshipId: string;
  sessionKey: string;
  runId: string;
  baseCheckpointId: string | null;
  candidateCheckpointId: string;
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

export function __clearActiveAffiliateRunCheckpointsForTests(): void {
  activeAffiliateRunCheckpoints.clear();
}
