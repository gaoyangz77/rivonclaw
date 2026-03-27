import { useMemo } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { createApolloClient } from "../api/apollo-client.js";

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => createApolloClient(), []);
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
