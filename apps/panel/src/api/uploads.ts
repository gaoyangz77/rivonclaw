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
      const json = await res.json() as { error?: string };
      if (json.error) message = json.error;
    } catch {
      // Non-JSON response.
    }
    throw new Error(message);
  }

  const uploaded = await res.json() as UploadedImageResult;
  return {
    ...uploaded,
    previewUrl: URL.createObjectURL(uploadFile),
  };
}
