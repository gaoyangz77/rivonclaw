import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApolloProvider } from "@apollo/client/react";
import { BrowserRouter } from "react-router-dom";
import { apolloClient } from "./api/client.js";
import { ExpertStoreProvider } from "./store/context.js";
import { AppRouter } from "./AppRouter.js";
import { I18nProvider } from "./i18n.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <I18nProvider>
        <ExpertStoreProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </ExpertStoreProvider>
      </I18nProvider>
    </ApolloProvider>
  </StrictMode>,
);
