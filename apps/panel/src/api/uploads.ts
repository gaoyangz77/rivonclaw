import { DEFAULTS } from "@rivonclaw/core";
import { CLOUD_REST } from "@rivonclaw/core/api-contract";

export interface UploadedImageResult {
  assetId: string;
  uri: string;
  publicUrl?: string | null;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  expiresAt?: string | null;
  previewUrl?: string | null;
}

const MAX_DIMENSION = DEFAULTS.chat.compressMaxDimension;
const TARGET_BYTES = DEFAULTS.chat.compressTargetBytes;
const INITIAL_QUALITY = DEFAULTS.chat.compressInitialQuality;
const MIN_QUALITY = DEFAULTS.chat.compressMinQuality;

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= TARGET_BYTES) return file;

  const image = await fileToImage(file);
  let { width, height } = image;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(image, 0, 0, width, height);

  let quality = INITIAL_QUALITY;
  let blob = await canvasToBlob(canvas, quality);
  while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.1);
    blob = await canvasToBlob(canvas, quality);
  }
  if (!blob || blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "inventory-good";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

/**
 * Durable media asset stored by the cloud media store. Markdown never stores
 * `publicUrl` — only `uri` (`media://<assetId>`), which stays valid when the
 * object-storage URL rotates or the client switches to the China relay.
 */
export interface UploadedMediaResult {
  assetId: string;
  uri: string;
  kind: "IMAGE" | "VIDEO";
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  publicUrl: string;
  sha256: string;
  deduplicated: boolean;
}

/** Mirrors the media store's accepted types; keep in sync with the backend. */
export const MEDIA_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export const MEDIA_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const MEDIA_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_VIDEO_MAX_BYTES = 100 * 1024 * 1024;

export type MediaRejection =
  | { reason: "unsupported-type" }
  | { reason: "too-large"; maxBytes: number };

export function isSupportedMediaVideo(file: File): boolean {
  return (MEDIA_VIDEO_MIME_TYPES as readonly string[]).includes(file.type);
}

/**
 * Client-side gate mirroring the media store's own limits, so an oversized or
 * unsupported file is reported in the merchant's language instead of coming
 * back as an opaque 400 after a long upload.
 */
export function checkMediaFile(file: File): MediaRejection | null {
  const isImage = (MEDIA_IMAGE_MIME_TYPES as readonly string[]).includes(file.type);
  const isVideo = isSupportedMediaVideo(file);
  if (!isImage && !isVideo) return { reason: "unsupported-type" };
  const maxBytes = isImage ? MEDIA_IMAGE_MAX_BYTES : MEDIA_VIDEO_MAX_BYTES;
  if (file.size > maxBytes) return { reason: "too-large", maxBytes };
  return null;
}

/**
 * Upload one image or video to the durable media store.
 *
 * Unlike {@link uploadInventoryGoodImage} this does not re-encode images: the
 * merchant is authoring reference documentation where a screenshot's text must
 * stay legible, PNG transparency and GIF animation must survive, and the 8 MB
 * cap is generous enough that silently degrading to JPEG would cost more than
 * it saves. Files over the cap are refused by {@link checkMediaFile} instead.
 */
export async function uploadProductKnowledgeMedia(file: File): Promise<UploadedMediaResult> {
  const body = new FormData();
  body.append("file", file);

  const res = await fetch(CLOUD_REST["uploads.media"].path, {
    method: "POST",
    body,
  });

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("rivonclaw:auth-expired"));
    throw new Error("Authentication required");
  }
  if (!res.ok) {
    let message = `Media upload failed: ${res.status} ${res.statusText}`;
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // Non-JSON response.
    }
    throw new Error(message);
  }

  return (await res.json()) as UploadedMediaResult;
}

export async function uploadInventoryGoodImage(file: File): Promise<UploadedImageResult> {
  const uploadFile = await compressImageForUpload(file);
  const body = new FormData();
  body.append("image", uploadFile);

  const res = await fetch(CLOUD_REST["uploads.images"].path, {
    method: "POST",
    body,
  });

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("rivonclaw:auth-expired"));
    throw new Error("Authentication required");
  }
  if (!res.ok) {
    let message = `Image upload failed: ${res.status} ${res.statusText}`;
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // Non-JSON response.
    }
    throw new Error(message);
  }

  const uploaded = (await res.json()) as UploadedImageResult;
  return {
    ...uploaded,
    previewUrl: URL.createObjectURL(uploadFile),
  };
}
