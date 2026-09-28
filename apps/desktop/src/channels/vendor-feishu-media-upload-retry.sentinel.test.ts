import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0042-vendor-openclaw-retry-transient-Feishu-media-uploads.patch",
);
const PATCHED_VENDOR_ROOT = resolve(__dirname, "../../../../tmp/vendor-patched/openclaw");
const VENDOR_ROOT = existsSync(PATCHED_VENDOR_ROOT)
  ? PATCHED_VENDOR_ROOT
  : resolve(__dirname, "../../../../vendor/openclaw");
const VENDOR_MEDIA = resolve(VENDOR_ROOT, "extensions/feishu/src/media.ts");

describe("vendor patch 0042: retry transient Feishu media uploads", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");
  const media = readFileSync(VENDOR_MEDIA, "utf8");

  it("keeps retry policy narrow, bounded, and jittered", () => {
    expect(media).toContain("const FEISHU_MEDIA_UPLOAD_ATTEMPTS = 3");
    expect(media).toContain('jitter: "full"');
    expect(media).toContain("shouldRetry: isTransientNetworkError");
    expect(media).not.toContain("retryTransient: true");
  });

  it("applies the retry boundary to file and image uploads only", () => {
    expect(media.match(/retryFeishuMediaUpload\(\(\) =>/g)).toHaveLength(2);
    expect(media).toMatch(/retryFeishuMediaUpload\(\(\) =>\s*client\.im\.image\.create/);
    expect(media).toMatch(/retryFeishuMediaUpload\(\(\) =>\s*client\.im\.file\.create/);
  });

  it("carries behavior tests that prevent duplicate message dispatch", () => {
    expect(patch).toContain(
      "retries transient file upload failures before dispatching one message",
    );
    expect(patch).toContain(
      "retries transient image upload failures before dispatching one message",
    );
    expect(patch).toContain("does not retry permanent upload failures");
    expect(patch).toContain("expect(messageCreateMock).toHaveBeenCalledTimes(1)");
    expect(patch).toContain("expect(messageCreateMock).not.toHaveBeenCalled()");
  });
});
