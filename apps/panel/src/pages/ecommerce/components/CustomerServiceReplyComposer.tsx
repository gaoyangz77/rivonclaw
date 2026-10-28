import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { useToast } from "../../../components/Toast.js";
import { TkAlert, TkComposer, TkButton } from "../../../components/design-system/index.js";
import { MessageEmojiButton } from "../../../components/inputs/MessageEmojiButton.js";
import { MessageAttachmentPreviews } from "../../../components/inputs/MessageAttachmentPreviews.js";
import { useMessageAttachmentDrafts } from "../../../hooks/useMessageAttachmentDrafts.js";

export const CustomerServiceReplyComposer = observer(function CustomerServiceReplyComposer({
  shopId,
  conversationId,
}: {
  shopId: string;
  conversationId: string;
}) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const disabled = sending || entityStore.customerServiceWorkspace.sendingManualReply;
  const attachments = useMessageAttachmentDrafts({
    scopeKey: `${shopId}:${conversationId}`,
    disabled,
    onError: (message) => showToast(message, "error"),
  });

  async function submit() {
    if (
      inFlight.current ||
      disabled ||
      (!entityStore.customerServiceWorkspace.manualReplyDraft.trim() && !attachments.items.length)
    )
      return;
    if (
      entityStore.customerServiceWorkspace.selectedConversationShopId !== shopId ||
      entityStore.customerServiceWorkspace.selectedConversationId !== conversationId
    )
      return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    const images = [...attachments.items];
    let refresh = false;
    let completed = false;
    try {
      if (entityStore.customerServiceWorkspace.manualReplyDraft.trim()) {
        refresh = true;
        // Refresh after the whole batch: resolving text can otherwise remove
        // this row from the Pending list and unmount the unsent image queue.
        if (!(await entityStore.customerServiceWorkspace.sendManualReply(i18n.language, false)))
          throw new Error(t("messageAttachments.sendUnknown"));
      }
      for (const item of images) {
        if (!mounted.current) return;
        refresh = true;
        const result = await entityStore.customerServiceWorkspace.sendManualImageReply({
          shopId,
          conversationId,
          file: item.file,
          idempotencyKey: `human-cs-image:${item.id}`,
        });
        if (!result?.ok) throw new Error(t("messageAttachments.sendUnknown"));
        if (mounted.current) attachments.remove(item.id);
      }
      completed = true;
      if (mounted.current)
        showToast(t("ecommerce.customerServiceWorkspace.manualReplySent"), "success");
    } catch (failure) {
      if (mounted.current) {
        const unknown = (failure as { code?: string }).code === "IDEMPOTENCY_STATUS_UNKNOWN";
        setError(
          unknown
            ? t("messageAttachments.sendUnknown")
            : failure instanceof Error
              ? failure.message
              : String(failure),
        );
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setSending(false);
        if (
          refresh &&
          entityStore.customerServiceWorkspace.selectedConversationShopId === shopId &&
          entityStore.customerServiceWorkspace.selectedConversationId === conversationId
        ) {
          void entityStore.customerServiceWorkspace.fetchConversationMessages(i18n.language);
          // Keep this conversation and its failed drafts visible for retry.
          if (completed) void entityStore.customerServiceWorkspace.fetchConversations();
        }
      }
    }
  }

  return (
    <div className="cs-manual-reply-form">
      {error ? (
        <TkAlert tone="danger" title={t("ecommerce.customerServiceWorkspace.manualReplyFailed")}>
          {error}
        </TkAlert>
      ) : null}
      <MessageAttachmentPreviews
        items={attachments.items}
        onRemove={attachments.remove}
        disabled={disabled}
      />
      <TkComposer
        data-tutorial-id="cs-manual-reply"
        value={entityStore.customerServiceWorkspace.manualReplyDraft}
        onValueChange={(value) => entityStore.customerServiceWorkspace.setManualReplyDraft(value)}
        onSubmit={() => void submit()}
        submitLabel={t("ecommerce.customerServiceWorkspace.manualReplySend")}
        submittingLabel={t("common.loading")}
        placeholder={t("ecommerce.customerServiceWorkspace.manualReplyPlaceholder")}
        submitDisabled={
          !entityStore.customerServiceWorkspace.manualReplyDraft.trim() && !attachments.items.length
        }
        submitting={disabled}
        textareaRef={textareaRef}
        textareaProps={{ rows: 2, onPaste: attachments.onPaste }}
        tools={
          <>
            <MessageEmojiButton
              textareaRef={textareaRef}
              onValueChange={(value) =>
                entityStore.customerServiceWorkspace.setManualReplyDraft(value)
              }
              disabled={disabled}
            />
            <TkButton
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => fileInput.current?.click()}
            >
              {t("messageAttachments.addImages")}
            </TkButton>
          </>
        }
      />
      <input
        ref={fileInput}
        className="message-attachment-file-input"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        disabled={disabled}
        onChange={(event) => {
          void attachments.addFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
});
