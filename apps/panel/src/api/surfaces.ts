import { getClient, trackedQuery } from "./apollo-client.js";
import {
  SURFACES_QUERY,
  SURFACE_PRESETS_QUERY,
  CREATE_SURFACE_MUTATION,
  CREATE_SURFACE_FROM_PRESET_MUTATION,
  UPDATE_SURFACE_MUTATION,
  DELETE_SURFACE_MUTATION,
} from "./surfaces-queries.js";
import { RUN_PROFILES_QUERY } from "./run-profiles-queries.js";

export interface Surface {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  allowedToolIds: string[];
  allowedCategories: string[];
  presetId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SurfacePreset {
  id: string;
  name: string;
  description: string;
  allowedToolIds: string[];
  allowedCategories: string[];
}

export async function fetchSurfaces(): Promise<Surface[]> {
  return trackedQuery(async () => {
    const result = await getClient().query<{ surfaces: Surface[] }>({
      query: SURFACES_QUERY,
      fetchPolicy: "cache-first",
    });
    return result.data!.surfaces;
  });
}

export async function fetchSurfacePresets(): Promise<SurfacePreset[]> {
  return trackedQuery(async () => {
    const result = await getClient().query<{ surfacePresets: SurfacePreset[] }>({
      query: SURFACE_PRESETS_QUERY,
      fetchPolicy: "cache-first",
    });
    return result.data!.surfacePresets;
  });
}

export async function createSurface(input: {
  name: string;
  description?: string;
  allowedToolIds: string[];
  allowedCategories: string[];
  presetId?: string;
}): Promise<Surface> {
  return trackedQuery(async () => {
    const result = await getClient().mutate<{ createSurface: Surface }>({
      mutation: CREATE_SURFACE_MUTATION,
      variables: { input },
      refetchQueries: [{ query: SURFACES_QUERY }],
    });
    return result.data!.createSurface;
  });
}

export async function createSurfaceFromPreset(presetId: string): Promise<Surface> {
  return trackedQuery(async () => {
    const result = await getClient().mutate<{ createSurfaceFromPreset: Surface }>({
      mutation: CREATE_SURFACE_FROM_PRESET_MUTATION,
      variables: { presetId },
      refetchQueries: [{ query: SURFACES_QUERY }],
    });
    return result.data!.createSurfaceFromPreset;
  });
}

export async function updateSurface(
  id: string,
  input: {
    name?: string;
    description?: string;
    allowedToolIds?: string[];
    allowedCategories?: string[];
  },
): Promise<Surface> {
  return trackedQuery(async () => {
    const result = await getClient().mutate<{ updateSurface: Surface }>({
      mutation: UPDATE_SURFACE_MUTATION,
      variables: { id, input },
      refetchQueries: [{ query: SURFACES_QUERY }],
    });
    return result.data!.updateSurface;
  });
}

export async function deleteSurface(id: string): Promise<boolean> {
  return trackedQuery(async () => {
    const result = await getClient().mutate<{ deleteSurface: boolean }>({
      mutation: DELETE_SURFACE_MUTATION,
      variables: { id },
      refetchQueries: [{ query: SURFACES_QUERY }, { query: RUN_PROFILES_QUERY }],
    });
    return result.data!.deleteSurface;
  });
}
