import {
  TOOL_SPECS_SYNC_QUERY,
  INIT_SURFACES_QUERY,
  INIT_RUN_PROFILES_QUERY,
  INIT_SHOPS_QUERY,
  INIT_PLATFORM_APPS_QUERY,
  INIT_CREDITS_QUERY,
} from "../cloud/init-queries.js";

type BootstrapStatus = "signed_out" | "loading" | "ready" | "error";

interface BootstrapRootStore {
  clearCloudEntities(): void;
  clearCloudDataExceptUser(): void;
  setAuthBootstrap(status: BootstrapStatus, error?: string | null): void;
  ingestGraphQLResponse(data: Record<string, unknown>): void;
}

interface BootstrapAuthSession {
  getAccessToken(): string | null | undefined;
  validate(): Promise<{ enrolledModules?: string[] } | null>;
  graphqlFetch(query: string): Promise<Record<string, unknown>>;
}

export async function bootstrapDesktopAuthState(
  authSession: BootstrapAuthSession,
  rootStore: BootstrapRootStore,
): Promise<void> {
  if (!authSession.getAccessToken()) {
    rootStore.clearCloudEntities();
    rootStore.setAuthBootstrap("signed_out", null);
    return;
  }

  rootStore.setAuthBootstrap("loading", null);

  try {
    const me = await authSession.validate();
    if (!me) {
      if (!authSession.getAccessToken()) {
        rootStore.clearCloudEntities();
        rootStore.setAuthBootstrap("signed_out", null);
        return;
      }
      throw new Error("Failed to load account profile");
    }

    rootStore.clearCloudDataExceptUser();
    rootStore.ingestGraphQLResponse({ me });

    const queries = [
      TOOL_SPECS_SYNC_QUERY,
      INIT_SURFACES_QUERY,
      INIT_RUN_PROFILES_QUERY,
    ];

    if (me.enrolledModules?.includes("GLOBAL_ECOMMERCE_SELLER")) {
      queries.push(INIT_SHOPS_QUERY, INIT_PLATFORM_APPS_QUERY, INIT_CREDITS_QUERY);
    }

    const results = await Promise.all(queries.map((query) => authSession.graphqlFetch(query)));
    for (const data of results) {
      rootStore.ingestGraphQLResponse(data);
    }

    rootStore.setAuthBootstrap("ready", null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rootStore.setAuthBootstrap("error", message);
    throw new Error(`Failed to load account state: ${message}`);
  }
}
