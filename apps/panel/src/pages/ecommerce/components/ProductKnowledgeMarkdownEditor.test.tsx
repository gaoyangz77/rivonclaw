import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "../../../i18n/index.js";
import {
  rememberMediaAsset,
  resetMediaUrlCache,
  resolveMediaUrl,
} from "../hooks/useProductKnowledgeMedia.js";
import {
  mediaDirectiveMarkdown,
  ProductKnowledgeMarkdownEditor,
} from "./ProductKnowledgeMarkdownEditor.js";

const IMAGE_URI = "media://0123456789abcdef01234567";
const VIDEO_URI = "media://89abcdef0123456789abcdef";

const { query, uploadMedia } = vi.hoisted(() => ({
  query: vi.fn(),
  uploadMedia: vi.fn(),
}));

vi.mock("../../../api/apollo-client.js", () => ({ getClient: () => ({ query }) }));
vi.mock("../../../api/uploads.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../api/uploads.js")>()),
  uploadProductKnowledgeMedia: uploadMedia,
}));

function mediaAsset(uri: string, publicUrl: string, kind: "IMAGE" | "VIDEO") {
  return {
    uri,
    assetId: uri.replace("media://", ""),
    kind,
    mimeType: kind === "IMAGE" ? "image/png" : "video/mp4",
    sizeBytes: 1024,
    width: null,
    height: null,
    publicUrl,
  };
}

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  resetMediaUrlCache();
  query.mockReset();
  uploadMedia.mockReset();
  query.mockImplementation(({ variables }: { variables: { uris: string[] } }) => ({
    data: {
      mediaAssetsByUri: variables.uris
        .filter((uri) => uri === IMAGE_URI || uri === VIDEO_URI)
        .map((uri) =>
          mediaAsset(
            uri,
            uri === IMAGE_URI
              ? "https://minio.rivonclaw.com/media/image.png"
              : "https://minio.rivonclaw.com/media/clip.mp4",
            uri === IMAGE_URI ? "IMAGE" : "VIDEO",
          ),
        ),
    },
  }));
});

afterEach(() => {
  cleanup();
});

describe("media directive markdown", () => {
  it("writes the stable media URI as a leaf directive with the file name", () => {
    expect(mediaDirectiveMarkdown(VIDEO_URI, "unboxing.mp4")).toBe(
      `::media{src="${VIDEO_URI}" name="unboxing.mp4"}`,
    );
  });

  it("keeps the attribute unambiguous when the file name carries quotes or newlines", () => {
    expect(mediaDirectiveMarkdown(VIDEO_URI, 'a"b\nc.mp4')).toBe(
      `::media{src="${VIDEO_URI}" name="a b c.mp4"}`,
    );
  });

  it("omits an empty name rather than emitting an empty attribute", () => {
    expect(mediaDirectiveMarkdown(VIDEO_URI, "  ")).toBe(`::media{src="${VIDEO_URI}"}`);
  });
});

describe("media URI resolution", () => {
  it("batches every URI requested in one tick into a single backend call", async () => {
    const [image, video] = await Promise.all([
      resolveMediaUrl(IMAGE_URI),
      resolveMediaUrl(VIDEO_URI),
    ]);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0].variables).toEqual({ uris: [IMAGE_URI, VIDEO_URI] });
    expect(image).toBe("https://minio.rivonclaw.com/media/image.png");
    expect(video).toBe("https://minio.rivonclaw.com/media/clip.mp4");
  });

  it("serves a URI it already resolved without asking the backend again", async () => {
    await resolveMediaUrl(IMAGE_URI);
    await resolveMediaUrl(IMAGE_URI);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("reports a URI the backend does not return as unresolved", async () => {
    await expect(resolveMediaUrl("media://ffffffffffffffffffffffff")).resolves.toBeNull();
  });

  it("skips the round-trip for media that was just uploaded", async () => {
    rememberMediaAsset(mediaAsset(VIDEO_URI, "https://minio.rivonclaw.com/media/fresh.mp4", "VIDEO"));
    await expect(resolveMediaUrl(VIDEO_URI)).resolves.toBe(
      "https://minio.rivonclaw.com/media/fresh.mp4",
    );
    expect(query).not.toHaveBeenCalled();
  });

  it("does not cache a failed lookup", async () => {
    query.mockRejectedValueOnce(new Error("offline"));
    await expect(resolveMediaUrl(IMAGE_URI)).rejects.toThrow("offline");
    await expect(resolveMediaUrl(IMAGE_URI)).resolves.toBe(
      "https://minio.rivonclaw.com/media/image.png",
    );
  });
});

describe("product knowledge markdown editor", () => {
  it("shows stored media as a compact card and only plays it once expanded", async () => {
    render(
      <ProductKnowledgeMarkdownEditor
        onChange={() => {}}
        placeholder=""
        readOnly={false}
        value={`${mediaDirectiveMarkdown(VIDEO_URI, "clip.mp4")}\n`}
      />,
    );

    // The card names the file and its size; nothing is played until asked.
    await waitFor(() => {
      expect(screen.getByText("clip.mp4")).toBeTruthy();
    });
    expect(document.querySelector("video")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { expanded: false }));
    });

    await waitFor(() => {
      const player = document.querySelector("video");
      expect(player?.getAttribute("src")).toBe("https://minio.rivonclaw.com/media/clip.mp4");
    });
  });

  it("renders the legacy ::video directive through the same card", async () => {
    render(
      <ProductKnowledgeMarkdownEditor
        onChange={() => {}}
        placeholder=""
        readOnly={false}
        value={`::video{src="${VIDEO_URI}" title="old-clip.mp4"}\n`}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("old-clip.mp4")).toBeTruthy();
    });
  });

  // MDXEditor paints an image only after the browser finishes loading it, which
  // jsdom never does, so the observable proof that stored images are displayed
  // is that opening the document resolves their URIs for this client.
  it("resolves a stored media:// image when existing content loads", async () => {
    render(
      <ProductKnowledgeMarkdownEditor
        onChange={() => {}}
        placeholder=""
        readOnly={false}
        value={`![cover](${IMAGE_URI})\n`}
      />,
    );

    await waitFor(() => {
      expect(query).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0][0].variables).toEqual({ uris: [IMAGE_URI] });
    });
  });

  it("uploads a picked video and inserts a media:// directive into the markdown", async () => {
    uploadMedia.mockResolvedValue({
      assetId: VIDEO_URI.replace("media://", ""),
      uri: VIDEO_URI,
      kind: "VIDEO",
      mimeType: "video/mp4",
      sizeBytes: 2048,
      publicUrl: "https://minio.rivonclaw.com/media/clip.mp4",
      sha256: "abc",
      deduplicated: false,
    });
    const onChange = vi.fn();
    const { container } = render(
      <ProductKnowledgeMarkdownEditor
        onChange={onChange}
        placeholder=""
        readOnly={false}
        value={`![cover](${IMAGE_URI})\n\nNote:this ships tomorrow\n\n:::warning\nkeep me\n:::\n`}
      />,
    );

    const input = container.querySelector('input[type="file"][accept*="video/mp4"]');
    expect(input).toBeTruthy();
    const file = new File(["video-bytes"], "clip.mp4", { type: "video/mp4" });
    await act(async () => {
      fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(uploadMedia).toHaveBeenCalledWith(file);
      const markdown = onChange.mock.calls.at(-1)?.[0] as string | undefined;
      expect(markdown).toContain(`::media{src="${VIDEO_URI}"`);
      expect(markdown).toContain('name="clip.mp4"');
      // The resolved object-storage URL must never leak into saved Markdown.
      expect(markdown).toContain(`![cover](${IMAGE_URI})`);
      expect(markdown).not.toContain("minio.rivonclaw.com");
      // A colon inside a sentence parses as a text directive. It must come back
      // out as the merchant typed it: directive support would escape the colon,
      // and that backslash would land in stored knowledge the Agent reads.
      expect(markdown).toContain("Note:this ships tomorrow");
      expect(markdown).not.toContain("\\:");
      // A block directive nobody has a descriptor for is carried through the
      // editor untouched instead of aborting the whole document import.
      expect(markdown).toContain(":::warning\nkeep me\n:::");
    });
  });

  it("uploads a picked image and inserts a media:// card into the markdown", async () => {
    uploadMedia.mockResolvedValue({
      assetId: IMAGE_URI.replace("media://", ""),
      uri: IMAGE_URI,
      kind: "IMAGE",
      mimeType: "image/png",
      sizeBytes: 1024,
      publicUrl: "https://minio.rivonclaw.com/media/image.png",
      sha256: "def",
      deduplicated: false,
    });
    const onChange = vi.fn();
    const { container } = render(
      <ProductKnowledgeMarkdownEditor
        onChange={onChange}
        placeholder=""
        readOnly={false}
        value={"Existing text\n"}
      />,
    );

    // The image picker is its own toolbar button: drag and paste already worked,
    // but nothing on screen said so.
    const input = container.querySelector('input[type="file"][accept*="image/png"]');
    expect(input).toBeTruthy();
    const file = new File(["png-bytes"], "packshot.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(uploadMedia).toHaveBeenCalledWith(file);
      const markdown = onChange.mock.calls.at(-1)?.[0] as string | undefined;
      expect(markdown).toContain(`::media{src="${IMAGE_URI}" name="packshot.png"}`);
      expect(markdown).not.toContain("minio.rivonclaw.com");
    });
  });

  it("refuses an unsupported file before it reaches the media store", async () => {
    const { container } = render(
      <ProductKnowledgeMarkdownEditor
        onChange={() => {}}
        placeholder=""
        readOnly={false}
        value={""}
      />,
    );

    const input = container.querySelector(
      'input[type="file"][accept*="image/png"]',
    ) as HTMLInputElement;
    const file = new File(["nope"], "notes.txt", { type: "text/plain" });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(uploadMedia).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("notes.txt");
  });
});
