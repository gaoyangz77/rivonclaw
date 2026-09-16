import { useEffect, useState } from "react";
import { routeFirstPartyUrl } from "@rivonclaw/core";
import { getClient } from "../../../api/apollo-client.js";
import {
  MEDIA_ASSETS_BY_URI_BATCH_LIMIT,
  MEDIA_ASSETS_BY_URI_QUERY,
  type MediaAssetsByUriResult,
} from "../../../api/media-asset-queries.js";

/**
 * Markdown authored in Product Knowledge stores media as `media://<assetId>`,
 * never as a URL: object-storage URLs rotate, and the China relay serves them
 * from a different host. This module turns those URIs into a URL fit for the
 * current client, once per URI, batching every URI a freshly opened document
 * asks for into a single backend round-trip.
 */

const MEDIA_URI_PATTERN = /^media:\/\/[0-9a-f]{24}$/;

/** uri -> display URL, or null when the backend does not know the asset. */
const resolvedUrls = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

type PendingEntry = {
  resolve: (url: string | null) => void;
  reject: (error: unknown) => void;
};
let pending = new Map<string, PendingEntry[]>();
let flushScheduled = false;

export function isMediaUri(value: string): boolean {
  return MEDIA_URI_PATTERN.test(value);
}

/**
 * Seed the cache from an upload response so media the merchant just inserted
 * renders without waiting for a backend round-trip.
 */
export function rememberMediaUrl(uri: string, publicUrl: string): void {
  resolvedUrls.set(uri, String(routeFirstPartyUrl(publicUrl)));
}

/** Test-only: drop every cached and in-flight resolution. */
export function resetMediaUrlCache(): void {
  resolvedUrls.clear();
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
        (data?.mediaAssetsByUri ?? []).map((asset) => [asset.uri, asset.publicUrl]),
      );
      for (const uri of chunk) {
        const publicUrl = found.get(uri);
        const url = publicUrl ? String(routeFirstPartyUrl(publicUrl)) : null;
        resolvedUrls.set(uri, url);
        for (const entry of batch.get(uri) ?? []) entry.resolve(url);
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
 * Resolve one `media://` URI to a displayable URL, or `null` when the backend
 * does not return the asset (deleted, or owned by someone else). Transport and
 * GraphQL failures reject so callers can retry rather than cache a lie.
 */
export function resolveMediaUrl(uri: string): Promise<string | null> {
  if (resolvedUrls.has(uri)) return Promise.resolve(resolvedUrls.get(uri) ?? null);

  const existing = inflight.get(uri);
  if (existing) return existing;

  const promise = new Promise<string | null>((resolve, reject) => {
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

export type MediaUrlState = "resolving" | "ready" | "unavailable";

/** Resolve a `media://` URI for render, re-resolving when the URI changes. */
export function useMediaUrl(uri: string | undefined): { url: string | null; state: MediaUrlState } {
  const cached = uri && resolvedUrls.has(uri) ? resolvedUrls.get(uri) ?? null : undefined;
  const [url, setUrl] = useState<string | null>(cached ?? null);
  const [state, setState] = useState<MediaUrlState>(() => {
    if (!uri || !isMediaUri(uri)) return "unavailable";
    if (cached === undefined) return "resolving";
    return cached ? "ready" : "unavailable";
  });

  useEffect(() => {
    if (!uri || !isMediaUri(uri)) {
      setUrl(null);
      setState("unavailable");
      return;
    }

    let cancelled = false;
    const known = resolvedUrls.has(uri) ? resolvedUrls.get(uri) ?? null : undefined;
    setUrl(known ?? null);
    setState(known === undefined ? "resolving" : known ? "ready" : "unavailable");
    if (known !== undefined) return;

    resolveMediaUrl(uri)
      .then((resolved) => {
        if (cancelled) return;
        setUrl(resolved);
        setState(resolved ? "ready" : "unavailable");
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

  return { url, state };
}
