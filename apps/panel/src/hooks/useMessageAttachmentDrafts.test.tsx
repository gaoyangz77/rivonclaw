import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n/index.js";
import { mockObjectUrls } from "../../test/mock-object-urls.js";
import { MessageAttachmentPreviews } from "../components/inputs/MessageAttachmentPreviews.js";
import { clipboardImageFiles, MESSAGE_IMAGE_MAX_BYTES } from "../lib/message-attachments.js";
import { useMessageAttachmentDrafts } from "./useMessageAttachmentDrafts.js";

let urls: ReturnType<typeof mockObjectUrls>;
beforeEach(async () => {
  await i18n.changeLanguage("zh");
  urls = mockObjectUrls();
});
afterEach(() => vi.unstubAllGlobals());

function Drafts({
  scope = "one",
  stage,
  disabled = false,
  onError = vi.fn(),
}: {
  scope?: string;
  disabled?: boolean;
  stage?: (file: File, signal: AbortSignal) => Promise<string>;
  onError?: (message: string) => void;
}) {
  const drafts = useMessageAttachmentDrafts({ scopeKey: scope, stage, disabled, onError });
  return (
    <>
      <textarea aria-label="Draft" onPaste={drafts.onPaste} />
      <MessageAttachmentPreviews items={drafts.items} onRemove={drafts.remove} />
      <output>{drafts.items.flatMap((item) => item.value ?? []).join(",")}</output>
    </>
  );
}
function paste(files: File[]) {
  fireEvent.paste(screen.getByRole("textbox"), { clipboardData: { files } });
}
const image = (name = "capture.png") => new File(["image"], name, { type: "image/png" });

describe("pasted attachment drafts", () => {
  it("previews pasted images, leaves ordinary text paste alone and revokes removed URLs", () => {
    const { unmount } = render(<Drafts />);
    fireEvent.paste(screen.getByRole("textbox"), { clipboardData: { files: [], items: [] } });
    expect(urls.create).not.toHaveBeenCalled();
    paste([image()]);
    expect(screen.getByRole("img", { name: "capture.png" }).getAttribute("src")).toBe(
      "blob:test-image-1",
    );
    fireEvent.click(screen.getByRole("button", { name: "移除 capture.png" }));
    expect(screen.queryByRole("img")).toBeNull();
    expect(urls.revoke).toHaveBeenCalledWith("blob:test-image-1");
    paste([image("next.png")]);
    unmount();
    expect(urls.revoke).toHaveBeenCalledWith("blob:test-image-2");
  });
  it("reads clipboard items when files are absent without adding the same file twice", () => {
    const file = image();
    const items = [{ kind: "file", getAsFile: () => file }] as unknown as DataTransferItemList;
    expect(clipboardImageFiles({ files: [] as unknown as FileList, items })).toEqual([file]);
    expect(clipboardImageFiles({ files: [file] as unknown as FileList, items })).toEqual([file]);
  });
  it("rejects oversized and unsupported clipboard images before staging and caps the queue", () => {
    const onError = vi.fn();
    const stage = vi.fn().mockResolvedValue("ok");
    render(<Drafts onError={onError} stage={stage} />);
    const large = image();
    Object.defineProperty(large, "size", { value: MESSAGE_IMAGE_MAX_BYTES + 1 });
    paste([large, new File(["svg"], "vector.svg", { type: "image/svg+xml" })]);
    expect(stage).not.toHaveBeenCalled();
    expect(urls.create).not.toHaveBeenCalled();
    paste(Array.from({ length: 11 }, (_, i) => image(`${i}.png`)));
    expect(screen.getAllByRole("img")).toHaveLength(10);
    expect(onError).toHaveBeenCalledWith("最多添加 10 个附件。");
  });
  it("aborts deleted uploads and discards late results when the conversation changes", async () => {
    let finish!: (value: string) => void;
    const stage = vi.fn(
      (_file: File, _signal: AbortSignal) =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const { rerender } = render(<Drafts stage={stage} />);
    paste([image()]);
    expect(screen.getByText("上传中…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "移除 capture.png" }));
    expect(stage.mock.calls[0][1].aborted).toBe(true);
    finish("deleted asset");
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).not.toContain("deleted asset"),
    );
    paste([image("other.png")]);
    rerender(<Drafts scope="two" stage={stage} />);
    expect(stage.mock.calls[1][1].aborted).toBe(true);
    finish("old conversation asset");
    await waitFor(() => expect(screen.queryByRole("img")).toBeNull());
    expect(screen.getByRole("status").textContent).toBe("");
  });
  it("does not stage or preview images while sending", () => {
    const stage = vi.fn();
    render(<Drafts disabled stage={stage} />);
    paste([image()]);
    expect(stage).not.toHaveBeenCalled();
    expect(urls.create).not.toHaveBeenCalled();
  });
});
