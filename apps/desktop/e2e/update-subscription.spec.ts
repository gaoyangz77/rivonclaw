/**
 * Update Subscription E2E — tests real-time update push via GraphQL Subscription.
 *
 * Part 1 (protocol-level): Connects directly to the staging backend's GraphQL
 * WebSocket endpoint and verifies both push mechanisms work.
 *
 * Part 2 (full app): Launches Electron, logs in to staging, publishes an update
 * via admin mutation, and verifies the update banner appears in the Panel UI.
 *
 * Requires staging credentials in e2e/.env:
 *   STAGING_TEST_USERNAME, STAGING_TEST_PASSWORD     — regular user
 *   STAGING_ADMIN_USERNAME, STAGING_ADMIN_PASSWORD    — admin user (for publishUpdate)
 *   STAGING_CAPTCHA_BYPASS_TOKEN, RIVONCLAW_API_BASE_URL
 */
import { test, expect } from "./electron-fixture.js";
import { test as rawTest, expect as rawExpect } from "@playwright/test";
import path from "node:path";
import dotenv from "dotenv";
import { createClient, type Client } from "graphql-ws";
import WebSocket from "ws";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const STAGING_API_BASE = process.env.RIVONCLAW_API_BASE_URL || "https://api-stg.rivonclaw.com";
const STAGING_GRAPHQL_URL = `${STAGING_API_BASE}/graphql`;
const STAGING_WS_URL = STAGING_API_BASE.replace(/^http/, "ws") + "/graphql";

const adminEmail = process.env.STAGING_ADMIN_USERNAME;
const adminPassword = process.env.STAGING_ADMIN_PASSWORD;
const testEmail = process.env.STAGING_TEST_USERNAME;
const testPassword = process.env.STAGING_TEST_PASSWORD;
const captchaBypass = process.env.STAGING_CAPTCHA_BYPASS_TOKEN;

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) { accessToken refreshToken }
  }
`;

const UPDATE_SUBSCRIPTION = `
  subscription UpdateAvailable($clientVersion: String!) {
    updateAvailable(clientVersion: $clientVersion) {
      version
      downloadUrl
    }
  }
`;

const PUBLISH_UPDATE_MUTATION = `
  mutation PublishUpdate($version: String!) {
    publishUpdate(version: $version)
  }
`;

interface UpdatePayload {
  version: string;
  downloadUrl?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginToStaging(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(STAGING_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: LOGIN_MUTATION,
      variables: {
        input: {
          email,
          password,
          captchaToken: captchaBypass ?? "test",
          captchaAnswer: "bypass",
        },
      },
    }),
  });
  const body = (await res.json()) as {
    data?: { login: { accessToken: string; refreshToken: string } };
    errors?: Array<{ message: string }>;
  };
  if (body.errors?.length) {
    throw new Error(`Login failed: ${body.errors[0].message}`);
  }
  return body.data!.login;
}

function createGqlWsClient(token: string): Client {
  return createClient({
    url: STAGING_WS_URL,
    webSocketImpl: WebSocket as any,
    connectionParams: { authorization: `Bearer ${token}` },
    retryAttempts: 0,
  });
}

/** Subscribe and collect events until `count` received or `timeoutMs` elapses. */
function collectSubscriptionEvents(
  client: Client,
  clientVersion: string,
  count: number,
  timeoutMs: number,
): Promise<UpdatePayload[]> {
  return new Promise((resolve) => {
    const events: UpdatePayload[] = [];
    let timer: ReturnType<typeof setTimeout>;

    const unsubscribe = client.subscribe<{ updateAvailable: UpdatePayload }>(
      { query: UPDATE_SUBSCRIPTION, variables: { clientVersion } },
      {
        next: (result) => {
          const payload = result.data?.updateAvailable;
          if (payload) {
            events.push(payload);
            if (events.length >= count) {
              clearTimeout(timer);
              unsubscribe();
              resolve(events);
            }
          }
        },
        error: () => {
          clearTimeout(timer);
          resolve(events);
        },
        complete: () => {
          clearTimeout(timer);
          resolve(events);
        },
      },
    );

    timer = setTimeout(() => {
      unsubscribe();
      resolve(events);
    }, timeoutMs);
  });
}

async function callPublishUpdate(
  token: string,
  version: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(STAGING_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: PUBLISH_UPDATE_MUTATION,
      variables: { version },
    }),
  });
  const body = (await res.json()) as {
    data?: { publishUpdate: boolean };
    errors?: Array<{ message: string }>;
  };
  if (body.errors?.length) {
    return { success: false, error: body.errors[0].message };
  }
  return { success: body.data?.publishUpdate === true };
}

// ---------------------------------------------------------------------------
// Part 1: Protocol-level tests (no Electron, direct WS to staging)
// ---------------------------------------------------------------------------

rawTest.describe("Update Subscription — protocol level", () => {
  rawTest.skip(!adminEmail || !adminPassword, "Staging admin credentials not configured");

  let adminToken: string;

  rawTest.beforeAll(async () => {
    const { accessToken } = await loginToStaging(adminEmail!, adminPassword!);
    adminToken = accessToken;
  });

  rawTest.afterAll(async () => {
    // Clean up: reset stored version so it doesn't pollute other tests or the real app
    await callPublishUpdate(adminToken, "0.0.0");
  });

  rawTest("connect-time pull: server pushes stored update when clientVersion is old", async () => {
    // Publish a high version so the server has a stored update
    const publishResult = await callPublishUpdate(adminToken, "99.0.0");
    rawExpect(publishResult.success).toBe(true);

    // Subscribe with a very low version to trigger connect-time pull
    const client = createGqlWsClient(adminToken);
    try {
      const events = await collectSubscriptionEvents(client, "0.0.1", 1, 10_000);
      rawExpect(events.length).toBeGreaterThanOrEqual(1);
      rawExpect(events[0].version).toBe("99.0.0");
    } finally {
      client.dispose();
    }
  });

  rawTest("connect-time pull ignored: no push when clientVersion >= stored", async () => {
    // Subscribe with a very high version — server should not push anything
    const client = createGqlWsClient(adminToken);
    try {
      const events = await collectSubscriptionEvents(client, "999.999.999", 1, 5_000);
      rawExpect(events.length).toBe(0);
    } finally {
      client.dispose();
    }
  });

  rawTest("admin push: publishUpdate broadcasts to active subscriber", async () => {
    // Subscribe with low version
    const client = createGqlWsClient(adminToken);
    try {
      const eventsPromise = collectSubscriptionEvents(client, "0.0.1", 2, 15_000);

      // Wait for subscription to establish, then publish a new version
      await new Promise((r) => setTimeout(r, 2_000));

      const uniqueVersion = `98.${Date.now() % 1000}.0`;
      const pushResult = await callPublishUpdate(adminToken, uniqueVersion);
      rawExpect(pushResult.success).toBe(true);

      const events = await eventsPromise;
      const pushEvent = events.find((e) => e.version === uniqueVersion);
      rawExpect(pushEvent).toBeDefined();
    } finally {
      client.dispose();
    }
  });
});

// ---------------------------------------------------------------------------
// Part 2: Full Electron E2E — admin push triggers update banner in Panel UI
// ---------------------------------------------------------------------------

test.describe("Update Subscription — full app E2E", () => {
  test.skip(!adminEmail || !adminPassword, "Staging admin credentials not configured");

  let adminToken: string;

  test.beforeAll(async () => {
    const { accessToken } = await loginToStaging(adminEmail!, adminPassword!);
    adminToken = accessToken;
  });

  test.afterAll(async () => {
    // Clean up: reset stored version so it doesn't pollute other tests or the real app
    await callPublishUpdate(adminToken, "0.0.0");
  });

  test("update banner appears after admin pushes a new version", async ({ window, apiBase }) => {
    // 1. Login the running Electron app to staging so it connects the subscription
    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }
    const { accessToken, refreshToken } = await loginToStaging(testEmail, testPassword);

    const storeRes = await fetch(`${apiBase}/api/auth/store-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, refreshToken }),
    });
    expect(storeRes.status).toBe(200);

    // Reload so the app picks up auth state and connects the update subscription
    await window.reload({ waitUntil: "domcontentloaded" });
    await expect(window.locator(".sidebar-brand")).toBeVisible({ timeout: 30_000 });

    // Wait for the subscription to establish (auth lifecycle → connect)
    await new Promise((r) => setTimeout(r, 3_000));

    // 2. Admin publishes a fake high version
    const testVersion = `97.${Date.now() % 1000}.0`;
    const pushResult = await callPublishUpdate(adminToken, testVersion);
    expect(pushResult.success).toBe(true);

    // 3. Verify the update banner appears in the Panel UI
    const banner = window.locator(".update-banner");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText(testVersion);
  });
});
