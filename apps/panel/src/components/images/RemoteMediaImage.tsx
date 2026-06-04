import { useEffect, useState, type CSSProperties } from "react";
import { API, clientPath } from "@rivonclaw/core/api-contract";
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
  className?: string;
  height?: string | number;
  width?: string | number;
  loading?: "eager" | "lazy";
  onResolvedUrlChange?: (url: string) => void;
  style?: CSSProperties;
};

const resolvedUrlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function resolveRemoteMediaUrl(sourceUrl: string): Promise<string> {
  const cached = resolvedUrlCache.get(sourceUrl);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(sourceUrl);
  if (existing) return existing;

  const promise = fetchJson<MediaCacheResolveResponse>(clientPath(API["mediaCache.resolve"]), {
    method: "POST",
    body: JSON.stringify({ sourceUrl }),
  })
    .then((result) => {
      if (result.proxied) {
        resolvedUrlCache.set(sourceUrl, result.url);
      }
      return result.url;
    })
    .finally(() => {
      inflight.delete(sourceUrl);
    });
  inflight.set(sourceUrl, promise);
  return promise;
}

export function RemoteMediaImage({
  sourceUrl,
  alt,
  className,
  height,
  width,
  loading = "lazy",
  onResolvedUrlChange,
  style,
}: RemoteMediaImageProps) {
  const [src, setSrc] = useState<string | undefined>(() => resolvedUrlCache.get(sourceUrl));
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = resolvedUrlCache.get(sourceUrl);
    setSrc(cached);
    if (cached) onResolvedUrlChange?.(cached);
    setRetrying(false);

    resolveRemoteMediaUrl(sourceUrl)
      .then((resolved) => {
        if (!cancelled) {
          setSrc(resolved);
          onResolvedUrlChange?.(resolved);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(sourceUrl);
          onResolvedUrlChange?.(sourceUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onResolvedUrlChange, sourceUrl]);

  const handleError = () => {
    if (retrying) return;
    setRetrying(true);
    void resolveRemoteMediaUrl(sourceUrl)
      .then((resolved) => {
        if (resolved !== src) {
          setSrc(resolved);
          onResolvedUrlChange?.(resolved);
        }
      })
      .catch(() => {});
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
