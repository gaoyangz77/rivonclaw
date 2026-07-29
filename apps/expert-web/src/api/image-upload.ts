import { getAccessToken } from "./auth-session.js";

export const EXPERT_IMAGE_MAX_COUNT = 3;
export const EXPERT_IMAGE_MAX_EDGE = 1280;
export const EXPERT_IMAGE_TARGET_BYTES = 900 * 1024;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface ExpertImageUpload {
  assetId: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface CompressedExpertImage {
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

export function fitImageDimensions(
  width: number,
  height: number,
  maxEdge = EXPERT_IMAGE_MAX_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("IMAGE_COMPRESSION_FAILED"));
      },
      "image/webp",
      quality,
    );
  });
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("IMAGE_PREVIEW_FAILED"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function compressExpertImage(file: File): Promise<CompressedExpertImage> {
  if (!ACCEPTED_TYPES.has(file.type)) throw new Error("IMAGE_TYPE_UNSUPPORTED");
  const source = await createImageBitmap(file);
  let dimensions = fitImageDimensions(source.width, source.height);
  let quality = 0.78;
  let blob: Blob | undefined;

  try {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("IMAGE_COMPRESSION_FAILED");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      blob = await canvasBlob(canvas, quality);
      if (blob.type !== "image/webp") throw new Error("IMAGE_COMPRESSION_FAILED");
      if (blob.size <= EXPERT_IMAGE_TARGET_BYTES) break;

      if (quality > 0.56) {
        quality -= 0.11;
      } else {
        dimensions = fitImageDimensions(
          Math.round(dimensions.width * 0.82),
          Math.round(dimensions.height * 0.82),
        );
        quality = 0.65;
      }
    }
  } finally {
    source.close();
  }

  if (!blob || blob.size > EXPERT_IMAGE_TARGET_BYTES) {
    throw new Error("IMAGE_COMPRESSION_FAILED");
  }
  return {
    blob,
    previewUrl: await blobDataUrl(blob),
    width: dimensions.width,
    height: dimensions.height,
  };
}

export async function uploadExpertImage(file: File): Promise<ExpertImageUpload> {
  const compressed = await compressExpertImage(file);
  const token = getAccessToken();
  if (!token) throw new Error("AUTHENTICATION_REQUIRED");

  const formData = new FormData();
  formData.append("image", compressed.blob, "expert-image.webp");
  const response = await fetch(
    import.meta.env.VITE_EXPERT_IMAGE_UPLOAD_URL || "/api/uploads/images",
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    },
  );
  const payload = (await response.json()) as {
    assetId?: string;
    publicUrl?: string | null;
    mimeType?: string;
    sizeBytes?: number;
    width?: number;
    height?: number;
    error?: string;
  };
  if (
    !response.ok ||
    !payload.assetId ||
    !payload.mimeType ||
    !payload.sizeBytes ||
    !payload.width ||
    !payload.height
  ) {
    throw new Error(payload.error || "IMAGE_UPLOAD_FAILED");
  }
  return {
    assetId: payload.assetId,
    publicUrl: payload.publicUrl || compressed.previewUrl,
    mimeType: payload.mimeType,
    sizeBytes: payload.sizeBytes,
    width: payload.width,
    height: payload.height,
  };
}
