import { useEffect, useState } from "react";

export interface ImageAssetPreviewProps {
  src?: string | null;
  alt: string;
  className?: string;
  emptyLabel: string;
  failedLabel: string;
  labelMode?: "visible" | "hidden";
}

export function ImageAssetPreview({
  src,
  alt,
  className,
  emptyLabel,
  failedLabel,
  labelMode = "visible",
}: ImageAssetPreviewProps) {
  const [status, setStatus] = useState<"empty" | "loading" | "loaded" | "failed">(src ? "loading" : "empty");

  useEffect(() => {
    setStatus(src ? "loading" : "empty");
  }, [src]);

  const label = status === "failed" ? failedLabel : status === "empty" ? emptyLabel : "";

  return (
    <div
      className={`image-asset-preview image-asset-preview-${status}${className ? ` ${className}` : ""}`}
      title={status === "failed" ? failedLabel : undefined}
    >
      {src && status !== "failed" && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
        />
      )}
      {label && status !== "loaded" && (
        <span className={labelMode === "hidden" ? "sr-only" : undefined}>
          {label}
        </span>
      )}
    </div>
  );
}
