import { useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon, CopyIcon } from "../../../../components/icons.js";
import { useToast } from "../../../../components/Toast.js";

/**
 * A platform id shown as text that copies itself on click: an order, request or tracking number.
 * It sits inside clickable rows, so the click never reaches the row.
 */
export function AfterSaleCopyValue({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
      showToast(t("common.copied"), "success");
    } catch {
      showToast(t("ecommerce.afterSale.copyFailed"), "error");
    }
  }

  return (
    <button
      type="button"
      className="after-sale-copy"
      title={label}
      aria-label={`${label}: ${value}`}
      onClick={(event) => void copy(event)}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <span>{value}</span>
      {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
    </button>
  );
}
