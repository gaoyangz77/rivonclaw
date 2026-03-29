import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { entityStore, connectEntityStore, disconnectEntityStore, type PanelRootStore } from "./entity-store.js";

const EntityStoreContext = createContext<PanelRootStore>(entityStore);

export function EntityStoreProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    connectEntityStore();
    // initSession after SSE is connected so patches aren't lost
    if (!initialized.current) {
      initialized.current = true;
      entityStore.initSession();
    }
    return () => disconnectEntityStore();
  }, []);

  return (
    <EntityStoreContext value={entityStore}>
      {children}
    </EntityStoreContext>
  );
}

/**
 * Access the Panel's MST entity store from any component.
 * Wrap the consuming component with `observer()` from mobx-react-lite
 * to get automatic re-rendering on store changes.
 */
export function useEntityStore(): PanelRootStore {
  return useContext(EntityStoreContext);
}
