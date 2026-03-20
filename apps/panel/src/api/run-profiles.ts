import { getClient, trackedQuery } from "./apollo-client.js";
import {
  RUN_PROFILES_QUERY,
  CREATE_RUN_PROFILE_MUTATION,
  UPDATE_RUN_PROFILE_MUTATION,
  DELETE_RUN_PROFILE_MUTATION,
} from "./run-profiles-queries.js";

export interface RunProfile {
  id: string;
  userId: string | null;
  name: string;
  selectedToolIds: string[];
  surfaceId: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchRunProfiles(surfaceId?: string): Promise<RunProfile[]> {
  return trackedQuery(async () => {
    const result = await getClient().query<{ runProfiles: RunProfile[] }>({
      query: RUN_PROFILES_QUERY,
      variables: surfaceId ? { surfaceId } : {},
      fetchPolicy: "cache-first",
    });
    return result.data!.runProfiles;
  });
}

export async function createRunProfile(input: {
  name: string;
  selectedToolIds: string[];
  surfaceId: string;
}): Promise<RunProfile> {
  return trackedQuery(async () => {
    const result = await getClient().mutate<{ createRunProfile: RunProfile }>({
      mutation: CREATE_RUN_PROFILE_MUTATION,
      variables: { input },
      refetchQueries: [{ query: RUN_PROFILES_QUERY }],
    });
    return result.data!.createRunProfile;
  });
}

export async function updateRunProfile(
  id: string,
  input: {
    name?: string;
    selectedToolIds?: string[];
    surfaceId?: string;
  },
): Promise<RunProfile> {
  return trackedQuery(async () => {
    const result = await getClient().mutate<{ updateRunProfile: RunProfile }>({
      mutation: UPDATE_RUN_PROFILE_MUTATION,
      variables: { id, input },
      refetchQueries: [{ query: RUN_PROFILES_QUERY }],
    });
    return result.data!.updateRunProfile;
  });
}

export async function deleteRunProfile(id: string): Promise<boolean> {
  return trackedQuery(async () => {
    const result = await getClient().mutate<{ deleteRunProfile: boolean }>({
      mutation: DELETE_RUN_PROFILE_MUTATION,
      variables: { id },
      refetchQueries: [{ query: RUN_PROFILES_QUERY }],
    });
    return result.data!.deleteRunProfile;
  });
}
