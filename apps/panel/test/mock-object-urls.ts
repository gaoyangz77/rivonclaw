import { vi, type Mock } from "vitest";

export function mockObjectUrls(): { create: Mock; revoke: Mock } {
  const OriginalURL = globalThis.URL;
  let sequence = 0;
  const create = vi.fn(() => `blob:test-image-${++sequence}`);
  const revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends OriginalURL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  return { create, revoke };
}
