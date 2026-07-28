import { createContext, useContext } from "react";
import type { Instance } from "mobx-state-tree";
import { ExpertStore, expertStore } from "./expert-store.js";

type ExpertStoreInstance = Instance<typeof ExpertStore>;
const StoreContext = createContext<ExpertStoreInstance>(expertStore);

export function ExpertStoreProvider({
  children,
  store = expertStore,
}: {
  children: React.ReactNode;
  store?: ExpertStoreInstance;
}) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useExpertStore(): ExpertStoreInstance {
  return useContext(StoreContext);
}
