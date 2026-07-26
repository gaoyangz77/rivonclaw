import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApolloProvider } from "@apollo/client/react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import { apolloClient } from "./api/client.js";
import { ExpertStoreProvider } from "./store/context.js";
import { App } from "./App.js";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <ExpertStoreProvider>
        <App />
      </ExpertStoreProvider>
    </ApolloProvider>
  </StrictMode>,
);
