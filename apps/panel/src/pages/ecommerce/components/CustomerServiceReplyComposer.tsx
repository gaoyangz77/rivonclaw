import {
  useMessageTranslation,
  type TranslationSendOutcome,
} from "../../../hooks/useMessageTranslation.js";
import { MessageTranslationPreview } from "../../../components/inputs/MessageTranslationPreview.js";
import {
  customerLanguageSamples,
  siteLanguage,
  translationIdentity,
} from "../../../lib/message-translation.js";
import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { useTranslation } from "react-i18next";
import { useEntityStore } from "../../../store/EntityStoreProvider.js";
import { useToast } from "../../../components/Toast.js";
import { TkAlert, TkComposer, TkButton } from "../../../components/design-system/index.js";
import { MessageEmojiButton } from "../../../components/inputs/MessageEmojiButton.js";
import { MessageAttachmentPreviews } from "../../../components/inputs/MessageAttachmentPreviews.js";
import { useMessageAttachmentDrafts } from "../../../hooks/useMessageAttachmentDrafts.js";

/**
 * Reply composer for the selected conversation. With `conversationId === null` it targets an
 * order draft (a searched order whose buyer has no conversation): the first send creates the
 * conversation, then sends through the normal path. The page keys this component by the
 * operator's selection, so it stays mounted while the draft becomes the real conversation.
 */
export const CustomerServiceReplyComposer = observer(function CustomerServiceReplyComposer({
  shopId,
  conversationId,
  orderId = null,
}: {
  shopId: string;
  conversationId: string | null;
  orderId?: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const entityStore = useEntityStore();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  // Fixed for this instance so unsent images and translation survive draft promotion.
  const scopeId = useRef(conversationId ?? `order:${orderId}`).current;
  // The conversation sends go to; null until an order draft is promoted.
  const resolvedConversationId = useRef(conversationId);
  const targetSelected = () => {
    const workspace = entityStore.customerServiceWorkspace;
    return resolvedConversationId.current
      ? workspace.selectedConversationShopId === shopId &&
          workspace.selectedConversationId === resolvedConversationId.current
      : workspace.selectedOrderDraftShopId === shopId &&
          workspace.selectedOrderDraftOrderId === orderId;
  };
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const sendBusy = sending || entityStore.customerServiceWorkspace.sendingManualReply;
  const evidence = customerLanguageSamples(
    entityStore.customerServiceWorkspace.conversationMessages,
  );
  const translation = useMessageTranslation({
    routeKey: JSON.stringify(["cs", shopId, scopeId]),
    draftFingerprint: () =>
      JSON.stringify([
        entityStore.customerServiceWorkspace.manualReplyDraft,
        attachments.items.map((item) => item.id),
      ]),
    text: entityStore.customerServiceWorkspace.manualReplyDraft,
    ...evidence,
    fallbackLanguage: siteLanguage(entityStore.shops?.find((shop) => shop.id === shopId)?.region),
    disabled: sendBusy,
    send: (text, textAlreadySent) => submit(text, textAlreadySent),
  });
  const disabled = sendBusy || translation.locked;
  const attachments = useMessageAttachmentDrafts({
    scopeKey: `${translationIdentity(entityStore.currentUser)}:${shopId}:${scopeId}`,
    disabled,
    onError: (message) => showToast(message, "error"),
  });

  async function submit(
    translatedText?: string,
    textAlreadySent = false,
  ): Promise<TranslationSendOutcome> {
    if (
      inFlight.current ||
      sendBusy ||
      (translation.locked && translatedText === undefined) ||
      (!(translatedText ?? entityStore.customerServiceWorkspace.manualReplyDraft).trim() &&
        !attachments.items.length)
    )
      return { complete: false };
    if (!targetSelected()) return { complete: false };
    inFlight.current = true;
    setSending(true);
    setError(null);
    const images = [...attachments.items];
    const original = entityStore.customerServiceWorkspace.manualReplyDraft;
    const identity = translationIdentity(entityStore.currentUser);
    let textSent = textAlreadySent;
    let refresh = false;
    let completed = false;
    try {
      if (!resolvedConversationId.current) {
        // A failure here leaves the order draft selected with the composer draft intact.
        const created = await entityStore.customerServiceWorkspace.promoteOrderDraft(
          shopId,
          orderId!,
        );
        resolvedConversationId.current = created.conversationId;
        if (!mounted.current || !targetSelected()) return { complete: false };
      }
      if (!textAlreadySent && (translatedText ?? original).trim()) {
        refresh = true;
        // Refresh after the whole batch: resolving text can otherwise remove
        // this row from the Pending list and unmount the unsent image queue.
        if (
          !(await entityStore.customerServiceWorkspace.sendManualReply(
            i18n.language,
            false,
            translatedText === undefined ? undefined : { message: translatedText, original },
          ))
        )
          throw new Error(t("messageAttachments.sendUnknown"));
        textSent = true;
      }
      for (const item of images) {
        if (
          !mounted.current ||
          translationIdentity(entityStore.currentUser) !== identity ||
          !targetSelected()
        )
          return { complete: false, textSent };
        refresh = true;
        const result = await entityStore.customerServiceWorkspace.sendManualImageReply({
          shopId,
          conversationId: resolvedConversationId.current!,
          file: item.file,
          idempotencyKey: `human-cs-image:${item.id}`,
        });
        if (!result?.ok) throw new Error(t("messageAttachments.sendUnknown"));
        if (mounted.current) attachments.remove(item.id);
      }
      completed = true;
      if (mounted.current)
        showToast(t("ecommerce.customerServiceWorkspace.manualReplySent"), "success");
      return { complete: true, textSent };
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
      return {
        complete: false,
        textSent,
        error: failure instanceof Error ? failure.message : String(failure),
      };
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setSending(false);
        if (
          refresh &&
          translationIdentity(entityStore.currentUser) === identity &&
          resolvedConversationId.current &&
          targetSelected()
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
      <MessageTranslationPreview controller={translation} />
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
        disabled={translation.locked}
        submitting={sendBusy}
        textareaRef={textareaRef}
        textareaProps={{ rows: 1, onPaste: attachments.onPaste }}
        secondaryActions={
          <TkButton
            variant="secondary"
            size="sm"
            disabled={
              disabled ||
              !entityStore.currentUser ||
              !entityStore.customerServiceWorkspace.manualReplyDraft.trim()
            }
            onClick={() => void translation.generate()}
          >
            {t("messageTranslation.button")}
          </TkButton>
        }
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
