export const MESSAGE_ATTACHMENT_LIMIT = 10;
export const MESSAGE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const MESSAGE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

/** A clipboard can expose the same image through both items and files. Read only one list. */
export function clipboardImageFiles(data: Pick<DataTransfer, "items" | "files">): File[] {
  const files = Array.from(data.files ?? []);
  const candidates = files.length
    ? files
    : Array.from(data.items ?? [])
        .filter((item) => item.kind === "file")
        .flatMap((item) => {
          const file = item.getAsFile();
          return file ? [file] : [];
        });
  return candidates.filter((file) => file.type.startsWith("image/"));
}
