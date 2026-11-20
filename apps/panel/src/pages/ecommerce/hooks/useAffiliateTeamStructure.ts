import { useCallback } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { GQL } from "@rivonclaw/core";
import {
  AFFILIATE_TEAM_STRUCTURE_QUERY,
  ARCHIVE_AFFILIATE_REGION_ADMIN_MUTATION,
  ARCHIVE_AFFILIATE_TEAM_LEAD_MUTATION,
  SET_AFFILIATE_TEAM_PARENT_MUTATION,
  WRITE_AFFILIATE_REGION_ADMIN_MUTATION,
  WRITE_AFFILIATE_TEAM_LEAD_MUTATION,
} from "../../../api/affiliate-team-structure-queries.js";
import type { TeamStructure } from "../affiliate-team-structure.js";

export interface TeamLeadSaveInput {
  /** Absent on create. */
  id?: string;
  /** Required on create; the Backend never changes it on update. */
  memberUserId?: string;
  displayName: string;
  parentLeadId: string | null;
  /** On update, whether the draft changed each field; unchanged fields are not sent. */
  displayNameChanged?: boolean;
  parentLeadIdChanged?: boolean;
}

export interface RegionAdminSaveInput {
  id?: string;
  memberUserId?: string;
  displayName: string;
  regions: GQL.ShopRegion[];
  shopIds: string[];
}

/**
 * Reads the admin team structure and owns its writes (ADR-112).
 *
 * The structure is an admin-only configuration read straight from the Backend
 * through the Desktop proxy; it has no entity-store model. So the "update the
 * visible state in the same action" rule is met by awaiting a refetch inside
 * every write before it resolves. Failures propagate to the caller, which is
 * the UI boundary that shows them.
 */
export function useAffiliateTeamStructure(options: { skip?: boolean } = {}) {
  const query = useQuery<{ affiliateTeamStructure: TeamStructure }>(
    AFFILIATE_TEAM_STRUCTURE_QUERY,
    { skip: options.skip, fetchPolicy: "cache-and-network" },
  );
  const [writeLead] = useMutation<
    { writeAffiliateTeamLead: { id: string } },
    { input: GQL.WriteAffiliateTeamLeadInput }
  >(WRITE_AFFILIATE_TEAM_LEAD_MUTATION);
  const [archiveLead] = useMutation<unknown, { id: string }>(ARCHIVE_AFFILIATE_TEAM_LEAD_MUTATION);
  const [writeAdmin] = useMutation<
    { writeAffiliateRegionAdmin: { id: string } },
    { input: GQL.WriteAffiliateRegionAdminInput }
  >(WRITE_AFFILIATE_REGION_ADMIN_MUTATION);
  const [archiveAdmin] = useMutation<unknown, { id: string }>(
    ARCHIVE_AFFILIATE_REGION_ADMIN_MUTATION,
  );
  const [setParentMutation] = useMutation<
    { setAffiliateTeamParent: TeamStructure },
    { input: GQL.SetAffiliateTeamParentInput }
  >(SET_AFFILIATE_TEAM_PARENT_MUTATION);

  const { refetch } = query;
  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const setParent = useCallback(
    async (
      subjectKind: GQL.AffiliateTeamParentSubjectKind,
      subjectId: string,
      parentLeadId: string | null,
    ) => {
      await setParentMutation({ variables: { input: { subjectKind, subjectId, parentLeadId } } });
      await reload();
    },
    [setParentMutation, reload],
  );

  /**
   * The Backend's lead write has no parent field, so a parent is a second call.
   * When only that second call fails the lead already exists; the refetch in
   * `finally` makes the page show it, and the error still reaches the caller.
   */
  const saveTeamLead = useCallback(
    async (input: TeamLeadSaveInput) => {
      try {
        let leadId = input.id;
        if (!leadId) {
          const created = await writeLead({
            variables: {
              input: { memberUserId: input.memberUserId, displayName: input.displayName },
            },
          });
          leadId = created.data?.writeAffiliateTeamLead.id;
          if (!leadId) throw new Error("AffiliateTeamLeadProfile was not returned");
        } else if (input.displayNameChanged) {
          await writeLead({ variables: { input: { id: leadId, displayName: input.displayName } } });
        }
        const parentWanted = input.id ? input.parentLeadIdChanged : input.parentLeadId !== null;
        if (parentWanted) {
          await setParentMutation({
            variables: {
              input: {
                subjectKind: GQL.AffiliateTeamParentSubjectKind.TeamLead,
                subjectId: leadId,
                parentLeadId: input.parentLeadId,
              },
            },
          });
        }
      } finally {
        await reload();
      }
    },
    [writeLead, setParentMutation, reload],
  );

  const archiveTeamLead = useCallback(
    async (id: string) => {
      try {
        await archiveLead({ variables: { id } });
      } finally {
        await reload();
      }
    },
    [archiveLead, reload],
  );

  const saveRegionAdmin = useCallback(
    async (input: RegionAdminSaveInput) => {
      try {
        await writeAdmin({
          variables: {
            input: {
              ...(input.id ? { id: input.id } : { memberUserId: input.memberUserId }),
              displayName: input.displayName,
              regions: input.regions,
              shopIds: input.shopIds,
            },
          },
        });
      } finally {
        await reload();
      }
    },
    [writeAdmin, reload],
  );

  const archiveRegionAdmin = useCallback(
    async (id: string) => {
      try {
        await archiveAdmin({ variables: { id } });
      } finally {
        await reload();
      }
    },
    [archiveAdmin, reload],
  );

  return {
    structure: query.data?.affiliateTeamStructure ?? null,
    loading: query.loading,
    error: query.error ?? null,
    reload,
    setParent,
    saveTeamLead,
    archiveTeamLead,
    saveRegionAdmin,
    archiveRegionAdmin,
  };
}
