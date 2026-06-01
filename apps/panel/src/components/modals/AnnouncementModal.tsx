import { useMemo } from "react";
import { Modal } from "./Modal.js";

export type AnnouncementActionRole = "PRIMARY" | "SECONDARY";
export type AnnouncementActionType = "DISMISS" | "NAVIGATE" | "EXTERNAL_URL";

export interface ActiveAnnouncementAction {
  role: AnnouncementActionRole;
  type: AnnouncementActionType;
  label?: string | null;
  path?: string | null;
  url?: string | null;
}

export interface ActiveAnnouncementTemplate {
  format: "SAFE_HTML";
  html: string;
}

export interface ActiveAnnouncement {
  id: string;
  key: string;
  surface: "DESKTOP_MODAL";
  category: "MARKETING" | "PRODUCT" | "BILLING" | "SYSTEM";
  priority: number;
  title: string;
  maxWidth: number;
  template: ActiveAnnouncementTemplate;
  actions: ActiveAnnouncementAction[];
}

interface AnnouncementModalProps {
  announcement: ActiveAnnouncement | null;
  isOpen: boolean;
  onClose: () => void;
  onBackdropClose: () => void;
  onAction: (action: ActiveAnnouncementAction, eventType: "PRIMARY_CLICK" | "SECONDARY_CLICK") => void;
}

const ALLOWED_TAGS = new Set([
  "section",
  "div",
  "header",
  "footer",
  "span",
  "strong",
  "em",
  "small",
  "p",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "br",
]);

const ALLOWED_ATTRIBUTES = new Set(["class", "aria-label", "role"]);
const ALLOWED_ROLES = new Set(["note", "list", "presentation"]);

function filterAnnouncementClasses(value: string): string {
  return value
    .split(/\s+/)
    .filter((className) => /^ann-[a-z0-9-]+$/.test(className))
    .join(" ");
}

function sanitizeElement(element: Element) {
  for (const attribute of Array.from(element.attributes)) {
    if (!ALLOWED_ATTRIBUTES.has(attribute.name)) {
      element.removeAttribute(attribute.name);
      continue;
    }
    if (attribute.name === "class") {
      const className = filterAnnouncementClasses(attribute.value);
      if (className) {
        element.setAttribute("class", className);
      } else {
        element.removeAttribute("class");
      }
    }
    if (attribute.name === "role" && !ALLOWED_ROLES.has(attribute.value)) {
      element.removeAttribute("role");
    }
  }
}

function sanitizeNode(node: Node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }

    const element = child as Element;
    const tagName = element.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) {
      element.remove();
      continue;
    }

    sanitizeElement(element);
    sanitizeNode(element);
  }
}

function sanitizeAnnouncementHtml(html: string): string {
  if (typeof document === "undefined") return "";
  const template = document.createElement("template");
  template.innerHTML = html;
  sanitizeNode(template.content);
  return template.innerHTML;
}

function eventTypeForAction(action: ActiveAnnouncementAction): "PRIMARY_CLICK" | "SECONDARY_CLICK" {
  return action.role === "PRIMARY" ? "PRIMARY_CLICK" : "SECONDARY_CLICK";
}

export function AnnouncementModal({
  announcement,
  isOpen,
  onClose,
  onBackdropClose,
  onAction,
}: AnnouncementModalProps) {
  const sanitizedHtml = useMemo(() => {
    if (!announcement) return "";
    if (announcement.template.format !== "SAFE_HTML") return "";
    return sanitizeAnnouncementHtml(announcement.template.html);
  }, [announcement]);

  if (!announcement) return null;
  const actions = [...announcement.actions].sort((left, right) => {
    const order = { SECONDARY: 0, PRIMARY: 1 };
    return order[left.role] - order[right.role];
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onBackdropClose={onBackdropClose}
      title={announcement.title}
      maxWidth={announcement.maxWidth || 560}
    >
      <div
        className="announcement-modal"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
      <div className="announcement-modal-actions">
        {actions.map((action) => (
          <button
            key={`${action.role}-${action.type}-${action.label || ""}`}
            type="button"
            className={action.role === "PRIMARY" ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => onAction(action, eventTypeForAction(action))}
          >
            {action.label || (action.role === "PRIMARY" ? "OK" : "Later")}
          </button>
        ))}
        {actions.length === 0 && (
          <button type="button" className="btn btn-primary" onClick={onClose}>
            OK
          </button>
        )}
      </div>
    </Modal>
  );
}
