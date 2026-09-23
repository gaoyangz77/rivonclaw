import { createContext, useContext, type ReactNode } from "react";

interface WorkspaceTabContextValue {
  tabId: string;
  active: boolean;
  view: Readonly<Record<string, string>>;
  setView: (view: Record<string, string>) => void;
  setDirty: (dirty: boolean) => void;
}

const WorkspaceTabContext = createContext<WorkspaceTabContextValue | null>(null);

export function WorkspaceTabProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: WorkspaceTabContextValue;
}) {
  return <WorkspaceTabContext value={value}>{children}</WorkspaceTabContext>;
}

export function useWorkspaceTab(): WorkspaceTabContextValue {
  const value = useContext(WorkspaceTabContext);
  if (!value) throw new Error("Workspace page must be inside WorkspaceTabProvider");
  return value;
}
