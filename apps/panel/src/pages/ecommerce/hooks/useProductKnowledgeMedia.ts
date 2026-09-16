import { useEffect, useState } from "react";
import { routeFirstPartyUrl } from "@rivonclaw/core";
import { getClient } from "../../../api/apollo-client.js";
import {
  MEDIA_ASSETS_BY_URI_BATCH_LIMIT,
  MEDIA_ASSETS_BY_URI_QUERY,
  type MediaAssetRef,
  type MediaAssetsByUriResult,
} from "../../../api/media-asset-queries.js";

/**
 * Markdown authored in Product Knowledge stores media as `media://<assetId>`,
 * never as a URL: object-storage URLs rotate, and the China relay serves them
 * from a different host. This module turns those URIs into an asset fit for the
 * current client, once per URI, batching every URI a freshly opened document
 * asks for into a single backend round-trip.
 */

const MEDIA_URI_PATTERN = /^media:\/\/[0-9a-f]{24}$/;

/** A resolved asset carries the URL this client should actually load. */
export type ResolvedMediaAsset = Omit<MediaAssetRef, "publicUrl"> & { url: string };

/** uri -> asset, or null when the backend does not know it. */
const resolved = new Map<string, ResolvedMediaAsset | null>();
const inflight = new Map<string, Promise<ResolvedMediaAsset | null>>();

type PendingEntry = {
  resolve: (asset: ResolvedMediaAsset | null) => void;
  reject: (error: unknown) => void;
};
let pending = new Map<string, PendingEntry[]>();
let flushScheduled = false;

export function isMediaUri(value: string): boolean {
  return MEDIA_URI_PATTERN.test(value);
}

/** An upload response reports unknown dimensions as absent, a query as null. */
type MediaAssetInput = Omit<MediaAssetRef, "width" | "height"> & {
  width?: number | null;
  height?: number | null;
};

function toResolvedAsset({ publicUrl, width, height, ...asset }: MediaAssetInput): ResolvedMediaAsset {
  return {
    ...asset,
    width: width ?? null,
    height: height ?? null,
    url: String(routeFirstPartyUrl(publicUrl)),
  };
}

/**
 * Seed the cache from an upload response so media the merchant just inserted
 * renders without waiting for a backend round-trip.
 */
export function rememberMediaAsset(asset: MediaAssetInput): void {
  resolved.set(asset.uri, toResolvedAsset(asset));
}

/** Test-only: drop every cached and in-flight resolution. */
export function resetMediaUrlCache(): void {
  resolved.clear();
  inflight.clear();
  pending = new Map();
  flushScheduled = false;
}

async function flushPending(): Promise<void> {
  const batch = pending;
  pending = new Map();
  flushScheduled = false;

  const uris = [...batch.keys()];
  for (let start = 0; start < uris.length; start += MEDIA_ASSETS_BY_URI_BATCH_LIMIT) {
    const chunk = uris.slice(start, start + MEDIA_ASSETS_BY_URI_BATCH_LIMIT);
    try {
      const { data } = await getClient().query<MediaAssetsByUriResult>({
        query: MEDIA_ASSETS_BY_URI_QUERY,
        variables: { uris: chunk },
      });
      const found = new Map(
        (data?.mediaAssetsByUri ?? []).map((asset) => [asset.uri, asset]),
      );
      for (const uri of chunk) {
        const asset = found.get(uri);
        const value = asset ? toResolvedAsset(asset) : null;
        resolved.set(uri, value);
        for (const entry of batch.get(uri) ?? []) entry.resolve(value);
      }
    } catch (error) {
      // A failed lookup must not be cached: the next render retries it.
      for (const uri of chunk) {
        for (const entry of batch.get(uri) ?? []) entry.reject(error);
      }
    }
  }
}

/**
 * Resolve one `media://` URI, or `null` when the backend does not return the
 * asset (deleted, or owned by someone else). Transport and GraphQL failures
 * reject so callers can retry rather than cache a lie.
 */
export function resolveMediaAsset(uri: string): Promise<ResolvedMediaAsset | null> {
  if (resolved.has(uri)) return Promise.resolve(resolved.get(uri) ?? null);

  const existing = inflight.get(uri);
  if (existing) return existing;

  const promise = new Promise<ResolvedMediaAsset | null>((resolve, reject) => {
    const entries = pending.get(uri) ?? [];
    entries.push({ resolve, reject });
    pending.set(uri, entries);
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(() => {
        void flushPending();
      });
    }
  }).finally(() => {
    inflight.delete(uri);
  });

  inflight.set(uri, promise);
  return promise;
}

/** URL-only convenience for callers that just need something to paint. */
export async function resolveMediaUrl(uri: string): Promise<string | null> {
  return (await resolveMediaAsset(uri))?.url ?? null;
}

export type MediaUrlState = "resolving" | "ready" | "unavailable";

/** Resolve a `media://` URI for render, re-resolving when the URI changes. */
export function useMediaAsset(uri: string | undefined): {
  asset: ResolvedMediaAsset | null;
  state: MediaUrlState;
} {
  const cached = uri && resolved.has(uri) ? resolved.get(uri) ?? null : undefined;
  const [asset, setAsset] = useState<ResolvedMediaAsset | null>(cached ?? null);
  const [state, setState] = useState<MediaUrlState>(() => {
    if (!uri || !isMediaUri(uri)) return "unavailable";
    if (cached === undefined) return "resolving";
    return cached ? "ready" : "unavailable";
  });

  useEffect(() => {
    if (!uri || !isMediaUri(uri)) {
      setAsset(null);
      setState("unavailable");
      return;
    }

    let cancelled = false;
    const known = resolved.has(uri) ? resolved.get(uri) ?? null : undefined;
    setAsset(known ?? null);
    setState(known === undefined ? "resolving" : known ? "ready" : "unavailable");
    if (known !== undefined) return;

    resolveMediaAsset(uri)
      .then((value) => {
        if (cancelled) return;
        setAsset(value);
        setState(value ? "ready" : "unavailable");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Surfaced to the merchant as the "unavailable" placeholder; logged so
        // a systematic lookup failure is visible rather than silent.
        console.error("Failed to resolve product knowledge media", uri, error);
        setState("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [uri]);

  return { asset, state };
}
