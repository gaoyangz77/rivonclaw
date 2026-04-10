import { StrictMode } from "react";
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
import { GraphQLLoadingProvider } from "./providers/GraphQLLoadingContext.js";
import { EntityStoreProvider } from "./store/EntityStoreProvider.js";
import { RuntimeStatusProvider } from "./store/RuntimeStatusProvider.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloWrapper>
      <GraphQLLoadingProvider>
        <EntityStoreProvider>
          <RuntimeStatusProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </RuntimeStatusProvider>
        </EntityStoreProvider>
      </GraphQLLoadingProvider>
    </ApolloWrapper>
  </StrictMode>,
);
