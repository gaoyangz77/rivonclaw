import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TkWorkspaceTabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  dirty?: boolean;
}

export function TkWorkspaceTabs({
  items,
  value,
  label,
  closeLabel,
  dirtyLabel,
  onChange,
  onClose,
  onReorder,
}: {
  items: TkWorkspaceTabItem[];
  value: string;
  label: string;
  closeLabel: string;
  dirtyLabel: string;
  onChange: (id: string) => void;
  onClose: (id: string) => void;
  onReorder: (id: string, targetIndex: number) => void;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number, id: string) {
    if (event.key === "Delete" || (event.key === "w" && (event.metaKey || event.ctrlKey))) {
      event.preventDefault();
      onClose(id);
      return;
    }
    if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      onReorder(id, Math.max(0, Math.min(items.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1))));
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (index + (event.key === "ArrowLeft" ? -1 : 1) + items.length) % items.length;
    onChange(items[target]!.id);
    tabRefs.current[target]?.focus();
  }

  return (
    <div className="tk-v1-workspace-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <div
          className={`tk-v1-workspace-tab${item.id === value ? " is-active" : ""}`}
          role="presentation"
          key={item.id}
          draggable
          onDragStart={() => setDraggedId(item.id)}
          onDragEnd={() => setDraggedId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedId) onReorder(draggedId, index);
            setDraggedId(null);
          }}
        >
          <button
            ref={(node) => { tabRefs.current[index] = node; }}
            className="tk-v1-workspace-tab-trigger"
            role="tab"
            type="button"
            id={`workspace-tab-${item.id}`}
            aria-controls={`workspace-panel-${item.id}`}
            aria-selected={item.id === value}
            tabIndex={item.id === value ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index, item.id)}
          >
            {item.icon && <span className="tk-v1-workspace-tab-icon">{item.icon}</span>}
            <span className="tk-v1-workspace-tab-label">{item.label}</span>
            {item.dirty && <span className="tk-v1-workspace-tab-dirty" aria-label={dirtyLabel}>●</span>}
          </button>
          <button
            type="button"
            className="tk-v1-workspace-tab-close"
            aria-label={`${closeLabel}: ${item.label}`}
            onClick={() => onClose(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
