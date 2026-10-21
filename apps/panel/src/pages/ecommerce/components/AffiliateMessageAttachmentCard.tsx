import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GQL } from "@rivonclaw/core";
import { TkPrivate, usePrivacyMode } from "../../../components/design-system/index.js";

/** Signed attachment routes are read only after user interaction, never via raw Provider URLs. */
export function AffiliateMessageAttachmentCard({ part, creatorRelationshipId }: {
  part: GQL.AffiliateHistoryPart; creatorRelationshipId: string;
}) {
  const { t } = useTranslation();
  const privacyMode = usePrivacyMode();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const isImage = part.mimeType?.startsWith("image/") ?? false;
  const prefix = "ecommerce.affiliateWorkspace.messageCards.";
  const typeLabel = t(`${prefix}${part.providerType === "EMOTICONS" ? "emoticon" : isImage ? "image" : "attachment"}`);
  async function open() {
    const attachmentRef = part.attachmentRef;
    const fileName = part.fileName ?? "attachment";
    if (!attachmentRef || loading || (isImage && privacyMode)) return;
    setLoading(true); setError(false);
    try {
      const response = await fetch("/api/cloud/ecommerce/affiliate/read-message-attachment", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Creator-Relationship-Id": creatorRelationshipId, "X-Affiliate-Read-Mode": "DOWNLOAD" },
        body: JSON.stringify({ attachmentRef }),
      });
      if (!response.ok) throw new Error(`Attachment ${response.status}`);
      const blob = await response.blob();
      if (!mounted.current) return;
      // Do not embed arbitrary attachment content (HTML/SVG) in the application document.
      const raster = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"].includes(blob.type.toLowerCase());
      const url = URL.createObjectURL(blob);
      if (isImage && raster) setPreviewUrl(url);
      else {
        const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch { setError(true); }
    finally { setLoading(false); }
  }
  return <div className="affiliate-message-attachment-card">
    <strong>{typeLabel}</strong>
    {!isImage && part.fileName ? <TkPrivate>{part.fileName}</TkPrivate> : null}
    {part.caption ? <TkPrivate>{part.caption}</TkPrivate> : null}
    {previewUrl && !privacyMode ? <>
      <img className="affiliate-message-image-preview" src={previewUrl} alt={typeLabel} />
      <button type="button" className="affiliate-inline-link-button" onClick={() => setPreviewUrl(null)}>{t("common.close")}</button>
    </> : part.attachmentRef ? <button type="button" className="btn btn-secondary btn-sm" disabled={loading || (isImage && privacyMode)} onClick={() => void open()}>
      {loading ? t("common.loading") : t(`${prefix}${isImage ? "viewImage" : "download"}`)}
    </button> : <span>{t(`${prefix}unavailable`)}</span>}
    {error ? <span role="alert">{t(`${prefix}mediaFailed`)}</span> : null}
  </div>;
}
