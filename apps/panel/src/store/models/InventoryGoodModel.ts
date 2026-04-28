import { InventoryGoodModel as InventoryGoodModelBase } from "@rivonclaw/core/models";

export function inventoryGoodImageUrl(imageUri?: string | null): string | null {
  if (!imageUri) return null;
  if (/^https?:\/\//i.test(imageUri)) return imageUri;
  const match = imageUri.match(/^s3:\/\/([^/]+)\/(.+)$/);
  if (!match) return imageUri;
  const [, bucket, objectKey] = match;
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  return `https://minio.rivonclaw.com/${encodeURIComponent(bucket)}/${encodedKey}`;
}

export const InventoryGoodModel = InventoryGoodModelBase.views((self) => ({
  get imageUrl() {
    return inventoryGoodImageUrl(self.imageUri);
  },
  get displaySku() {
    return self.sku || self.id;
  },
}));
