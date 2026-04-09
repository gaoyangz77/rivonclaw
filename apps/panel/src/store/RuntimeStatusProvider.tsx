import { createContext, useContext, useEffect, type ReactNode } from "react";
import { applySnapshot } from "mobx-state-tree";
import {
  runtimeStatusStore,
  connectRuntimeStatusStore,
  disconnectRuntimeStatusStore,
  type PanelRuntimeStatusStore,
} from "./runtime-status-store.js";

// Dev helper: expose store to console for manual testing.
// Usage:  __runtimeStatus.simulateCsBridge("reconnecting", 3)
//         __runtimeStatus.simulateCsBridge("disconnected")
//         __runtimeStatus.simulateCsBridge("connected")
if (import.meta.env.DEV) {
  (window as any).__runtimeStatus = {
    store: runtimeStatusStore,
    simulateCsBridge(state: "connected" | "disconnected" | "reconnecting", attempt = 0) {
      applySnapshot(runtimeStatusStore.csBridge, { state, reconnectAttempt: attempt });
    },
  };
}

const RuntimeStatusContext = createContext<PanelRuntimeStatusStore>(runtimeStatusStore);

export function RuntimeStatusProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    connectRuntimeStatusStore();
    return () => disconnectRuntimeStatusStore();
  }, []);

  return (
    <RuntimeStatusContext value={runtimeStatusStore}>
      {children}
    </RuntimeStatusContext>
  );
}

/**
 * Access the Panel's runtime status store from any component.
 * Wrap the consuming component with `observer()` from mobx-react-lite
 * to get automatic re-rendering on store changes.
 */
export function useRuntimeStatus(): PanelRuntimeStatusStore {
  return useContext(RuntimeStatusContext);
}
