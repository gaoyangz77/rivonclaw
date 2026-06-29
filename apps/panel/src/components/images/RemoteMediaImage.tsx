import { useEffect, useState, type CSSProperties } from "react";
import { routeFirstPartyUrl } from "@rivonclaw/core";
import { API, clientPath } from "@rivonclaw/core/api-contract";
import { DEFAULTS } from "@rivonclaw/core/defaults";
import { fetchJson } from "../../api/client.js";

type MediaCacheResolveResponse = {
  sourceUrl: string;
  url: string;
  proxied: boolean;
  route: "global" | "cn-relay";
};

type RemoteMediaImageProps = {
  sourceUrl: string;
  alt: string;
  cachePolicy?: "auto" | "force";
  className?: string;
  height?: string | number;
  width?: string | number;
  loading?: "eager" | "lazy";
  onResolvedUrlChange?: (url: string) => void;
  onImageError?: () => void;
  style?: CSSProperties;
};

const resolvedUrlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function cacheKey(sourceUrl: string, cachePolicy: "auto" | "force"): string {
  return `${cachePolicy}:${sourceUrl}`;
}

function isFirstPartyObjectStorageUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname === DEFAULTS.domains.objectStorage || parsed.hostname === DEFAULTS.domains.objectStorageCn;
  } catch {
    return false;
  }
}

function resolveFirstPartyObjectStorageUrl(sourceUrl: string): string | null {
  if (!isFirstPartyObjectStorageUrl(sourceUrl)) return null;
  return String(routeFirstPartyUrl(sourceUrl));
}

function resolveRemoteMediaUrl(sourceUrl: string, cachePolicy: "auto" | "force"): Promise<string> {
  const firstPartyUrl = resolveFirstPartyObjectStorageUrl(sourceUrl);
  if (firstPartyUrl) return Promise.resolve(firstPartyUrl);

  const key = cacheKey(sourceUrl, cachePolicy);
  const cached = resolvedUrlCache.get(key);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetchJson<MediaCacheResolveResponse>(clientPath(API["mediaCache.resolve"]), {
    method: "POST",
    body: JSON.stringify({ sourceUrl, forceProxy: cachePolicy === "force" }),
  })
    .then((result) => {
      if (result.proxied) {
        resolvedUrlCache.set(key, result.url);
      }
      return result.url;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

export function RemoteMediaImage({
  sourceUrl,
  alt,
  cachePolicy = "auto",
  className,
  height,
  width,
  loading = "lazy",
  onResolvedUrlChange,
  onImageError,
  style,
}: RemoteMediaImageProps) {
  const [src, setSrc] = useState<string | undefined>(
    () => resolveFirstPartyObjectStorageUrl(sourceUrl) ?? resolvedUrlCache.get(cacheKey(sourceUrl, cachePolicy)),
  );
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const firstPartyUrl = resolveFirstPartyObjectStorageUrl(sourceUrl);
    if (firstPartyUrl) {
      setSrc(firstPartyUrl);
      onResolvedUrlChange?.(firstPartyUrl);
      setRetrying(false);
      return () => {
        cancelled = true;
      };
    }

    const cached = resolvedUrlCache.get(cacheKey(sourceUrl, cachePolicy));
    setSrc(cached);
    if (cached) onResolvedUrlChange?.(cached);
    setRetrying(false);

    resolveRemoteMediaUrl(sourceUrl, cachePolicy)
      .then((resolved) => {
        if (!cancelled) {
          setSrc(resolved);
          onResolvedUrlChange?.(resolved);
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (cachePolicy === "force") {
            setSrc(undefined);
            onImageError?.();
          } else {
            setSrc(sourceUrl);
            onResolvedUrlChange?.(sourceUrl);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cachePolicy, onImageError, onResolvedUrlChange, sourceUrl]);

  const handleError = () => {
    if (retrying) return;
    setRetrying(true);
    void resolveRemoteMediaUrl(sourceUrl, cachePolicy)
      .then((resolved) => {
        if (resolved !== src) {
          setSrc(resolved);
          onResolvedUrlChange?.(resolved);
        }
      })
      .catch(() => {
        onImageError?.();
      });
  };

  return (
    <img
      alt={alt}
      className={className}
      height={height}
      loading={loading}
      onError={handleError}
      src={src}
      style={style}
      width={width}
    />
  );
}
