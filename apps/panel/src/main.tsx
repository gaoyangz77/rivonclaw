import { StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";
import "./theme-default.css";
import "./theme-orange.css";
import "./theme-emerald.css";
import "./theme-rose.css";
import "./theme-violet.css";
import "./theme-crimson.css";
import "./theme-gold.css";
import "./theme-tiffany.css";
import "./theme-gray.css";
import "./i18n/index.js";
import { App } from "./App.js";
import { ApolloWrapper } from "./providers/ApolloWrapper.js";
import { ToastProvider } from "./components/Toast.js";
import { GraphQLLoadingProvider } from "./contexts/GraphQLLoadingContext.js";
import { initStoreBindings, usePanelStore } from "./stores/index.js";

// Wire Apollo client callbacks to the Zustand store at module level.
// setTokenGetter / setOnTokenRefreshed / setOnRefreshFailed just set
// module-level variables that the auth link reads lazily, so this is
// safe to call before the Apollo client instance exists.
initStoreBindings();

function StoreInitializer({ children }: { children: React.ReactNode }) {
  const initSession = usePanelStore((s) => s.initSession);
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initSession();
  }, [initSession]);
  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloWrapper>
      <GraphQLLoadingProvider>
        <StoreInitializer>
          <ToastProvider>
            <App />
          </ToastProvider>
        </StoreInitializer>
      </GraphQLLoadingProvider>
    </ApolloWrapper>
  </StrictMode>,
);
