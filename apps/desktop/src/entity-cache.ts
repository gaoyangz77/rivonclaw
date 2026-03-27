import { createStore } from "zustand/vanilla";
import type { GQL } from "@rivonclaw/core";

interface CachedRunProfile {
  id: string;
  name: string;
  selectedToolIds: string[];
  surfaceId?: string;
  userId?: string | null;
}

interface CachedSurface {
  id: string;
  name: string;
  allowedToolIds: string[];
  userId?: string | null;
}

export interface CachedShop {
  id: string;
  platform: string;
  platformShopId: string;
  shopName: string;
  services?: {
    customerService?: {
      enabled?: boolean;
      businessPrompt?: string;
      csDeviceId?: string | null;
      csModelOverride?: string | null;
      runProfileId?: string | null;
      assembledPrompt?: string | null;
    };
  };
}

/**
 * Normalize a backend ShopPlatform enum value (e.g., "TIKTOK_SHOP") into a
 * short lowercase name suitable for session keys (e.g., "tiktok").
 */
export function normalizePlatform(raw: string): string {
  return raw.replace(/_(?:SHOP|STORE)$/i, "").toLowerCase();
}

interface EntityCacheState {
  runProfiles: CachedRunProfile[];
  surfaces: CachedSurface[];
  toolSpecs: GQL.ToolSpec[];
  shops: CachedShop[];
}

export const entityCache = createStore<EntityCacheState & {
  ingestGraphQLResponse(data: Record<string, unknown>): void;
  getRunProfile(id: string): CachedRunProfile | undefined;
  getToolIdsForSurface(surfaceName: string): string[];
  getToolIdsForRunProfile(profileName: string): string[];
  getShop(id: string): CachedShop | undefined;
  getShopByPlatformId(platformShopId: string): CachedShop | undefined;
  getDerivedSurfaces(): CachedSurface[];
  getDerivedRunProfiles(): CachedRunProfile[];
  getAllSurfaces(): CachedSurface[];
  getAllRunProfiles(): CachedRunProfile[];
}>()((set, get) => ({
  runProfiles: [],
  surfaces: [],
  toolSpecs: [],
  shops: [],

  ingestGraphQLResponse(data) {
    if (Array.isArray(data.runProfiles)) set({ runProfiles: data.runProfiles });
    if (Array.isArray(data.surfaces)) set({ surfaces: data.surfaces });
    if (Array.isArray(data.toolSpecs)) set({ toolSpecs: data.toolSpecs });
    if (Array.isArray(data.shops)) set({ shops: data.shops });
    // Single mutations — RunProfiles
    if (data.createRunProfile && typeof data.createRunProfile === "object") {
      set(s => ({ runProfiles: [...s.runProfiles, data.createRunProfile as CachedRunProfile] }));
    }
    if (data.updateRunProfile && typeof data.updateRunProfile === "object") {
      const u = data.updateRunProfile as CachedRunProfile;
      set(s => ({ runProfiles: s.runProfiles.map(p => p.id === u.id ? u : p) }));
    }
    // Single mutations — Surfaces
    if (data.createSurface && typeof data.createSurface === "object") {
      set(s => ({ surfaces: [...s.surfaces, data.createSurface as CachedSurface] }));
    }
    if (data.updateSurface && typeof data.updateSurface === "object") {
      const u = data.updateSurface as CachedSurface;
      set(s => ({ surfaces: s.surfaces.map(x => x.id === u.id ? u : x) }));
    }
    // Single mutations — Shops
    if (data.createShop && typeof data.createShop === "object") {
      set(s => ({ shops: [...s.shops, data.createShop as CachedShop] }));
    }
    if (data.updateShop && typeof data.updateShop === "object") {
      const u = data.updateShop as CachedShop;
      set(s => ({ shops: s.shops.map(x => x.id === u.id ? u : x) }));
    }
    if (data.deleteShop && typeof data.deleteShop === "object") {
      const d = data.deleteShop as { id: string };
      set(s => ({ shops: s.shops.filter(x => x.id !== d.id) }));
    }
  },

  getRunProfile(id) { return get().runProfiles.find(p => p.id === id); },

  getToolIdsForSurface(surfaceName) {
    const target = surfaceName.toUpperCase();
    return get().toolSpecs
      .filter(spec => spec.surfaces?.some(s => s.toUpperCase() === target))
      .map(spec => spec.id);
  },

  getToolIdsForRunProfile(profileName) {
    const target = profileName.toUpperCase();
    return get().toolSpecs
      .filter(spec => spec.runProfiles?.some(rp => rp.toUpperCase() === target))
      .map(spec => spec.id);
  },

  getShop(id) { return get().shops.find(s => s.id === id); },

  getShopByPlatformId(platformShopId) {
    return get().shops.find(s => s.platformShopId === platformShopId);
  },

  getDerivedSurfaces() {
    const { toolSpecs } = get();
    const surfaceMap = new Map<string, string[]>();
    for (const spec of toolSpecs) {
      if (!spec.surfaces) continue;
      for (const name of spec.surfaces) {
        let toolIds = surfaceMap.get(name);
        if (!toolIds) { toolIds = []; surfaceMap.set(name, toolIds); }
        toolIds.push(spec.id);
      }
    }
    const derived: CachedSurface[] = [];
    for (const [name, toolIds] of surfaceMap) {
      derived.push({
        id: name,
        name,
        allowedToolIds: toolIds,
        userId: "",
      });
    }
    return derived;
  },

  getDerivedRunProfiles() {
    const { toolSpecs } = get();
    const profileMap = new Map<string, string[]>();
    for (const spec of toolSpecs) {
      if (!spec.runProfiles) continue;
      for (const name of spec.runProfiles) {
        let toolIds = profileMap.get(name);
        if (!toolIds) { toolIds = []; profileMap.set(name, toolIds); }
        toolIds.push(spec.id);
      }
    }
    const derivedSurfaces = get().getDerivedSurfaces();
    const profiles: CachedRunProfile[] = [];
    for (const [name, toolIds] of profileMap) {
      const matchingSurface = derivedSurfaces.find(s => {
        if (s.id === "Default") return false;
        const surfaceToolSet = new Set(s.allowedToolIds);
        return toolIds.every(tid => surfaceToolSet.has(tid));
      });
      profiles.push({
        id: name,
        name,
        selectedToolIds: toolIds,
        surfaceId: matchingSurface?.id ?? "Default",
        userId: "",
      });
    }
    return profiles;
  },

  getAllSurfaces() {
    const defaultSurface: CachedSurface = { id: "Default", name: "Default", allowedToolIds: [], userId: "" };
    return [defaultSurface, ...get().getDerivedSurfaces(), ...get().surfaces];
  },

  getAllRunProfiles() {
    return [...get().getDerivedRunProfiles(), ...get().runProfiles];
  },
}));
