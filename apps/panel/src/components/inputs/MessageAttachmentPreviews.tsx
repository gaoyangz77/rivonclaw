import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MessageAttachmentDraft } from "../../hooks/useMessageAttachmentDrafts.js";
import { TkButton } from "../design-system/index.js";
import "./MessageAttachmentPreviews.css";

export function MessageAttachmentPreviews<T>({
  items,
  onRemove,
  disabled,
  extra,
}: {
  items: readonly MessageAttachmentDraft<T>[];
  onRemove: (id: string) => void;
  disabled?: boolean;
  extra?: (item: MessageAttachmentDraft<T>) => ReactNode;
}) {
  const { t } = useTranslation();
  if (!items.length) return null;
  return (
    <div className="message-attachment-previews" aria-label={t("messageAttachments.pending")}>
      {items.map((item) => (
        <div className="message-attachment-preview" key={item.id}>
          {item.previewUrl ? (
            <img
              className="message-attachment-thumbnail"
              src={item.previewUrl}
              alt={item.file.name}
            />
          ) : null}
          <div className="message-attachment-caption">
            <span>
              {item.file.name} · {Math.ceil(item.file.size / 1024)} KB
            </span>
            {item.status === "uploading" ? (
              <span role="status">{t("messageAttachments.uploading")}</span>
            ) : null}
            {item.error ? <span role="alert">{item.error}</span> : null}
          </div>
          {extra?.(item)}
          <TkButton
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={`${t("common.remove")} ${item.file.name}`}
            onClick={() => onRemove(item.id)}
          >
            {t("common.remove")}
          </TkButton>
        </div>
      ))}
    </div>
  );
}
