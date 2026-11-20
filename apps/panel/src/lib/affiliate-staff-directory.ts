import type { GQL } from "@rivonclaw/core";
import type { SelectOption } from "../components/inputs/Select.js";

/**
 * The BDs a staff login can name (ADR-112): a team lead's subtree, or the BDs
 * a region admin may filter and allocate by. A staff login cannot read the
 * supervisor roster (`affiliateBusinessDevelopers`), so every BD dropdown and
 * owner label they see is built from this directory instead.
 */
export interface AffiliateStaffDeveloper {
  id: string;
  displayName: string;
  /** The team lead the BD reports to, when the directory knows it (a team lead's subtree does). */
  teamName: string | null;
}

/** The BDs of a team lead's subtree, ordered team by team, each with its lead's name. */
export function affiliateSubtreeDevelopers(
  subtree: Pick<GQL.AffiliateTeamLeadSubtree, "self" | "descendantLeads" | "businessDevelopers">,
): AffiliateStaffDeveloper[] {
  const leads = [subtree.self, ...subtree.descendantLeads.slice().sort(byName)];
  const teamIndex = new Map(leads.map((lead, index) => [lead.id, index] as const));
  const teamName = new Map(leads.map((lead) => [lead.id, lead.displayName] as const));
  const rank = (developer: { parentLeadId?: string | null }) =>
    (developer.parentLeadId ? teamIndex.get(developer.parentLeadId) : undefined) ?? leads.length;
  return subtree.businessDevelopers
    .slice()
    .sort((a, b) => rank(a) - rank(b) || byName(a, b))
    .map((developer) => ({
      id: developer.id,
      displayName: developer.displayName,
      teamName: (developer.parentLeadId && teamName.get(developer.parentLeadId)) || null,
    }));
}

/** BDs a region admin may name; the Backend does not tell which team they belong to. */
export function affiliateRegionDevelopers(
  options: readonly Pick<GQL.AffiliateAllocationBusinessDeveloper, "id" | "displayName">[],
): AffiliateStaffDeveloper[] {
  return options
    .slice()
    .sort(byName)
    .map((option) => ({ id: option.id, displayName: option.displayName, teamName: null }));
}

/** One list from several; the first list to name a BD wins, which keeps the team name. */
export function mergeAffiliateStaffDevelopers(
  ...lists: readonly (readonly AffiliateStaffDeveloper[])[]
): AffiliateStaffDeveloper[] {
  const merged = new Map<string, AffiliateStaffDeveloper>();
  for (const developer of lists.flat()) {
    if (!merged.has(developer.id)) merged.set(developer.id, developer);
  }
  return [...merged.values()];
}

export interface AffiliateStaffDeveloperOptionLabels {
  /** The "no BD filter" entry: the whole team for a team lead, everyone for a region admin. */
  all: string;
  /** The public pool entry, or absent when the surface has none. */
  publicPool?: { value: string; label: string };
}

/**
 * Dropdown options for a staff BD filter. The directory order is kept, so a
 * team lead's BDs stay grouped by the lead they report to; the lead's name is
 * the option description and is searchable.
 */
export function affiliateStaffDeveloperOptions(
  developers: readonly AffiliateStaffDeveloper[],
  labels: AffiliateStaffDeveloperOptionLabels,
): SelectOption[] {
  return [
    { value: "", label: labels.all },
    ...(labels.publicPool ? [labels.publicPool] : []),
    ...developers.map((developer) => ({
      value: developer.id,
      label: developer.displayName,
      description: developer.teamName ?? undefined,
      searchTerms: developer.teamName ? [developer.teamName] : undefined,
    })),
  ];
}

function byName(a: { displayName: string }, b: { displayName: string }): number {
  return a.displayName.localeCompare(b.displayName);
}
