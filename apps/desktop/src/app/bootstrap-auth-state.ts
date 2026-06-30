import {
  INIT_SURFACES_QUERY,
  INIT_RUN_PROFILES_QUERY,
  INIT_SHOPS_QUERY,
  INIT_ADS_ADVERTISERS_QUERY,
  INIT_PLATFORM_APPS_QUERY,
  INIT_BILLING_OVERVIEW_QUERY,
  INIT_WMS_ACCOUNTS_QUERY,
  INIT_WAREHOUSES_QUERY,
  INIT_INVENTORY_GOODS_QUERY,
} from "../cloud/init-queries.js";
import { syncDesktopToolSpecs } from "../cloud/tool-specs-sync.js";

const ECOMMERCE_MODULE_ID = "GLOBAL_ECOMMERCE_SELLER";

type BootstrapStatus = "signed_out" | "loading" | "ready" | "error";

interface BootstrapRootStore {
  clearCloudEntities(): void;
  clearCloudDataExceptUser(options?: { preserveShops?: boolean }): void;
  setAuthBootstrap(status: BootstrapStatus, error?: string | null): void;
  ingestGraphQLResponse(data: Record<string, unknown>): void;
}

interface BootstrapAuthSession {
  getAccessToken(): string | null | undefined;
  validate(): Promise<{ enrolledModules?: string[] } | null>;
  graphqlFetch<T = Record<string, unknown>>(query: string): Promise<T>;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBootstrapQuery(
  authSession: BootstrapAuthSession,
  query: string,
): Promise<Record<string, unknown>> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await authSession.graphqlFetch(query);
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await wait(350);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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

    const queries = [
      INIT_SURFACES_QUERY,
      INIT_RUN_PROFILES_QUERY,
    ];

    queries.push(
      INIT_PLATFORM_APPS_QUERY,
      INIT_BILLING_OVERVIEW_QUERY,
    );

    const hasEcommerceModule = me.enrolledModules?.includes(ECOMMERCE_MODULE_ID) ?? false;
    if (hasEcommerceModule) {
      queries.push(
        INIT_SHOPS_QUERY,
        INIT_ADS_ADVERTISERS_QUERY,
        INIT_WMS_ACCOUNTS_QUERY,
        INIT_WAREHOUSES_QUERY,
        INIT_INVENTORY_GOODS_QUERY,
      );
    }

    rootStore.ingestGraphQLResponse({ me });

    const results = await Promise.allSettled([
      syncDesktopToolSpecs({
        authSession,
        ingest: false,
        source: "auth-bootstrap",
      }).then((snapshot) => snapshot.data),
      ...queries.map((query) => fetchBootstrapQuery(authSession, query)),
    ]);

    rootStore.clearCloudDataExceptUser({ preserveShops: hasEcommerceModule });
    for (const result of results) {
      if (result.status === "fulfilled") {
        rootStore.ingestGraphQLResponse(result.value);
      }
    }

    rootStore.setAuthBootstrap("ready", null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rootStore.setAuthBootstrap("error", message);
    throw new Error(`Failed to load account state: ${message}`);
  }
}
