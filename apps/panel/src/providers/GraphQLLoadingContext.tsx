import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { registerLoadingCallbacks } from "../api/apollo-client.js";

interface GraphQLLoadingContextType {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
}

const GraphQLLoadingContext = createContext<GraphQLLoadingContextType>({
  isLoading: false,
  startLoading: () => {},
  stopLoading: () => {},
});

export function GraphQLLoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const startLoading = useCallback(() => setCount((c) => c + 1), []);
  const stopLoading = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);

  useEffect(() => {
    registerLoadingCallbacks(startLoading, stopLoading);
    return () => registerLoadingCallbacks(() => {}, () => {});
  }, [startLoading, stopLoading]);

  const value = useMemo(
    () => ({ isLoading: count > 0, startLoading, stopLoading }),
    [count, startLoading, stopLoading],
  );

  return (
    <GraphQLLoadingContext.Provider value={value}>
      {children}
      {count > 0 && <div className="graphql-loading-overlay" />}
    </GraphQLLoadingContext.Provider>
  );
}

export function useGraphQLLoading() {
  return useContext(GraphQLLoadingContext);
}
