import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
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
import "./components/design-system/tk-v1.css";
import "./i18n/index.js";
import { installHost } from "./host/index.js";
import { App } from "./App.js";
import { ApolloWrapper } from "./providers/ApolloWrapper.js";
import { ToastProvider } from "./components/Toast.js";
import { GraphQLLoadingProvider } from "./providers/GraphQLLoadingContext.js";
import { EntityStoreProvider } from "./store/EntityStoreProvider.js";
import { RuntimeStatusProvider } from "./store/RuntimeStatusProvider.js";

import { entityStore } from "./store/entity-store.js";
import { runtimeStatusStore } from "./store/runtime-status-store.js";

/**
 * The only place that decides which host this build runs on. Everything else
 * reaches transport, events and auth through `getHost()`. The choice is made at
 * build time (`VITE_PANEL_HOST`, set by `vite build --mode web`); the branch
 * that is not taken is dropped from the bundle.
 *
 * Returns false when the viewer is being sent to sign in and nothing should render.
 */
async function selectHost(): Promise<boolean> {
  if (import.meta.env.VITE_PANEL_HOST === "web") {
    const { createWebHost } = await import("./host/web/web-host.js");
    const host = createWebHost({
      store: {
        clearCloudEntities: () => entityStore.clearCloudEntities(),
        clearCloudDataExceptUser: (options) => entityStore.clearCloudDataExceptUser(options),
        setAuthBootstrap: (status, error) => entityStore.setAuthBootstrap(status, error ?? null),
        ingestGraphQLResponse: (data) => entityStore.ingestGraphQLResponse(data),
        removeEntity: (typeName, id) => entityStore.removeEntity(typeName, id),
        upsertShopsFromGraphQL: (shops, reason) => entityStore.upsertShopsFromGraphQL(shops, reason),
        shopIds: () => entityStore.shops.map((shop) => shop.id),
      },
      applySettings: (all) => runtimeStatusStore.applyLocalSettings(all),
      storage: window.localStorage,
      navigate: (url) => window.location.assign(url),
      currentPath: () => window.location.pathname + window.location.search,
    });
    installHost(host);
    return host.start();
  }
  const { createDesktopHost } = await import("./host/desktop/desktop-host.js");
  installHost(createDesktopHost());
  return true;
}

function render() {
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
}

selectHost()
  .then((ready) => {
    if (ready) render();
  })
  .catch((error) => {
    console.error("[panel] failed to start", error);
    throw error;
  });
