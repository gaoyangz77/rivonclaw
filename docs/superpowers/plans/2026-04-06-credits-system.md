# Credits System + OpenRouter Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3-mode access (credits / coding-plan / subscription) with a cloud-backed credits system that proxies OpenRouter requests for new users.

**Architecture:** New `apps/cloud-api` Hono backend handles device auth + credit ledger + OpenRouter proxy using our master key. New `packages/credits-client` SDK wraps cloud-api calls. Desktop reads `access_mode` from SQLite settings on startup; in credits mode it calls cloud-api to get a JWT, then configures OpenClaw's openrouter provider to point at cloud-api proxy with JWT as API key. Panel gets `CreditsPage` + `AccessModePage` that talk to desktop's local API, which proxies through to cloud-api. Skills marketplace unchanged.

**Tech Stack:** Hono + @hono/node-server + postgres + jose (cloud-api), vitest (tests), existing RouteHandler pattern (desktop), React 19 (panel)

---

## File Map

**New files:**
- `apps/cloud-api/package.json`
- `apps/cloud-api/tsconfig.json`
- `apps/cloud-api/.env.example`
- `apps/cloud-api/src/index.ts`
- `apps/cloud-api/src/db/schema.sql`
- `apps/cloud-api/src/db/client.ts`
- `apps/cloud-api/src/middleware/auth.ts`
- `apps/cloud-api/src/routes/auth.ts`
- `apps/cloud-api/src/routes/credits.ts`
- `apps/cloud-api/src/routes/proxy.ts`
- `apps/cloud-api/src/routes/recharge.ts`
- `apps/cloud-api/src/__tests__/auth.test.ts`
- `apps/cloud-api/src/__tests__/credits.test.ts`
- `apps/cloud-api/src/__tests__/proxy.test.ts`
- `packages/credits-client/package.json`
- `packages/credits-client/tsconfig.json`
- `packages/credits-client/src/index.ts`
- `packages/credits-client/src/__tests__/client.test.ts`
- `packages/core/src/access-mode.ts`
- `apps/desktop/src/api-routes/credits-routes.ts`
- `apps/desktop/src/credits/credits-initializer.ts`
- `apps/panel/src/api/credits.ts`
- `apps/panel/src/components/CreditsBalance.tsx`
- `apps/panel/src/pages/CreditsPage.tsx`
- `apps/panel/src/pages/AccessModePage.tsx`

**Modified files:**
- `packages/core/src/index.ts` — export `AccessMode`, `ACCESS_MODE_KEY`, `DEFAULT_ACCESS_MODE`
- `apps/desktop/package.json` — add `@rivonclaw/credits-client: workspace:*`
- `apps/desktop/src/api-routes/index.ts` — export `handleCreditsRoutes`
- `apps/desktop/src/api-routes/api-context.ts` — add `creditsInitializer` field
- `apps/panel/src/api/index.ts` — re-export from `./credits.js`
- `apps/panel/src/App.tsx` — add `/access-mode` + `/credits` to PAGES, fix credits-mode onboarding check
- `apps/panel/src/layout/Layout.tsx` — add nav entries for `/credits` + `/access-mode`

---

## Task 1: Cloud API project scaffold

**Files:**
- Create: `apps/cloud-api/package.json`
- Create: `apps/cloud-api/tsconfig.json`
- Create: `apps/cloud-api/.env.example`
- Create: `apps/cloud-api/src/index.ts`

- [ ] **Step 1: Create `apps/cloud-api/package.json`**

```json
{
  "name": "@rivonclaw/cloud-api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@hono/node-server": "^1.14.0",
    "hono": "^4.7.0",
    "jose": "^5.10.0",
    "postgres": "^3.4.5"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "tsx": "^4.19.3",
    "typescript": "^5.8.3",
    "vitest": "^3.1.1"
  }
}
```

- [ ] **Step 2: Create `apps/cloud-api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["src/__tests__"]
}
```

- [ ] **Step 3: Create `apps/cloud-api/.env.example`**

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/rivonclaw_credits
OPENROUTER_MASTER_KEY=sk-or-v1-...
JWT_SECRET=change-me-to-a-random-32-char-string
FREE_CREDITS=100
PORT=3100
```

- [ ] **Step 4: Create `apps/cloud-api/src/index.ts`**

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { authRoute } from "./routes/auth.js";
import { creditsRoute } from "./routes/credits.js";
import { proxyRoute } from "./routes/proxy.js";
import { rechargeRoute } from "./routes/recharge.js";

const app = new Hono();

app.route("/api/auth", authRoute);
app.route("/api/credits", creditsRoute);
app.route("/api/proxy", proxyRoute);
app.route("/api/recharge", rechargeRoute);

app.get("/health", (c) => c.json({ ok: true }));

export default app;

// Only start the server when run directly (not during tests)
if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3100);
  serve({ fetch: app.fetch, port }, () => {
    console.log(`cloud-api listening on port ${port}`);
  });
}
```

- [ ] **Step 5: Install dependencies**

```bash
cd apps/cloud-api && pnpm install
```

Expected: packages installed without errors.

- [ ] **Step 6: Commit**

```bash
git add apps/cloud-api/package.json apps/cloud-api/tsconfig.json apps/cloud-api/.env.example apps/cloud-api/src/index.ts
git commit -m "feat(cloud-api): scaffold Hono app with route stubs"
```

---

## Task 2: Database schema and client

**Files:**
- Create: `apps/cloud-api/src/db/schema.sql`
- Create: `apps/cloud-api/src/db/client.ts`

- [ ] **Step 1: Create `apps/cloud-api/src/db/schema.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    TEXT UNIQUE NOT NULL,
  jwt_secret   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  credits_init BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  delta      INTEGER NOT NULL,
  reason     TEXT NOT NULL CHECK (reason IN ('signup_bonus', 'consumption', 'recharge')),
  model      TEXT,
  tokens     INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_balance (
  user_id    UUID PRIMARY KEY REFERENCES users(id),
  balance    INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast history queries
CREATE INDEX IF NOT EXISTS idx_ledger_user_created ON credit_ledger(user_id, created_at DESC);
```

- [ ] **Step 2: Create `apps/cloud-api/src/db/client.ts`**

```typescript
import postgres from "postgres";

// sql is a tagged-template query function — always use it as sql`...`
export const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
});
```

- [ ] **Step 3: Apply schema to your Supabase/Postgres instance**

Run the contents of `schema.sql` in your database console (Supabase SQL editor or `psql`).
Verify by running: `SELECT table_name FROM information_schema.tables WHERE table_schema='public';`
Expected output includes: `users`, `credit_ledger`, `credit_balance`.

- [ ] **Step 4: Commit**

```bash
git add apps/cloud-api/src/db/
git commit -m "feat(cloud-api): add postgres schema and client"
```

---

## Task 3: Device auth route + tests

**Files:**
- Create: `apps/cloud-api/src/routes/auth.ts`
- Create: `apps/cloud-api/src/__tests__/auth.test.ts`

The device auth flow: client sends `device_id` → server upserts user + issues JWT signed with user's `jwt_secret` → responds with token + current balance. New users get `FREE_CREDITS` (from env, default 100).

- [ ] **Step 1: Write the failing test first**

Create `apps/cloud-api/src/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { testClient } from "hono/testing";
import { authRoute } from "../routes/auth.js";

// Mock the db client
vi.mock("../db/client.js", () => ({
  sql: vi.fn(),
}));

import { sql } from "../db/client.js";

describe("POST /device", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-global-secret-32chars-padded!";
    process.env.FREE_CREDITS = "100";
  });

  it("registers a new device and returns token + balance", async () => {
    const mockUser = {
      id: "uuid-123",
      device_id: "device-abc",
      jwt_secret: "user-secret-12345678901234567890",
      credits_init: false,
    };

    // sql is called multiple times: upsert user, check credits_init, insert ledger, update balance
    const sqlMock = sql as unknown as ReturnType<typeof vi.fn>;
    sqlMock
      .mockResolvedValueOnce([mockUser])                        // upsert user
      .mockResolvedValueOnce(undefined)                         // INSERT ledger (signup_bonus)
      .mockResolvedValueOnce(undefined)                         // UPSERT credit_balance
      .mockResolvedValueOnce(undefined)                         // UPDATE users SET credits_init
      .mockResolvedValueOnce([{ balance: 100 }]);               // SELECT balance

    const client = testClient(authRoute);
    const res = await client.device.$post({ json: { deviceId: "device-abc" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ balance: 100 });
    expect(typeof body.token).toBe("string");
  });

  it("returns 400 when deviceId is missing", async () => {
    const client = testClient(authRoute);
    const res = await client.device.$post({ json: {} });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/cloud-api && pnpm test -- auth
```

Expected: FAIL — `authRoute` is not exported yet.

- [ ] **Step 3: Implement `apps/cloud-api/src/routes/auth.ts`**

```typescript
import { Hono } from "hono";
import { SignJWT } from "jose";
import { sql } from "../db/client.js";
import { randomBytes } from "node:crypto";

export const authRoute = new Hono();

authRoute.post("/device", async (c) => {
  const body = await c.req.json<{ deviceId?: string }>();
  if (!body.deviceId || typeof body.deviceId !== "string") {
    return c.json({ error: "deviceId is required" }, 400);
  }

  const { deviceId } = body;
  const jwtSecret = randomBytes(32).toString("hex");
  const freeCredits = Number(process.env.FREE_CREDITS ?? 100);

  // Upsert user — create if not exists, return existing if already there
  const [user] = await sql<{ id: string; jwt_secret: string; credits_init: boolean }[]>`
    INSERT INTO users (device_id, jwt_secret)
    VALUES (${deviceId}, ${jwtSecret})
    ON CONFLICT (device_id) DO UPDATE SET device_id = EXCLUDED.device_id
    RETURNING id, jwt_secret, credits_init
  `;

  if (!user) return c.json({ error: "db error" }, 500);

  // Grant signup bonus on first auth
  if (!user.credits_init) {
    await sql`
      INSERT INTO credit_ledger (user_id, delta, reason)
      VALUES (${user.id}, ${freeCredits}, 'signup_bonus')
    `;
    await sql`
      INSERT INTO credit_balance (user_id, balance)
      VALUES (${user.id}, ${freeCredits})
      ON CONFLICT (user_id) DO UPDATE SET balance = credit_balance.balance + ${freeCredits}, updated_at = now()
    `;
    await sql`
      UPDATE users SET credits_init = true WHERE id = ${user.id}
    `;
  }

  // Read current balance
  const [row] = await sql<{ balance: number }[]>`
    SELECT balance FROM credit_balance WHERE user_id = ${user.id}
  `;
  const balance = row?.balance ?? 0;

  // Issue JWT signed with user's own secret (different per user, not the global secret)
  const secret = new TextEncoder().encode(user.jwt_secret);
  const token = await new SignJWT({ sub: user.id, did: deviceId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  return c.json({ token, balance });
});
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
cd apps/cloud-api && pnpm test -- auth
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cloud-api/src/routes/auth.ts apps/cloud-api/src/__tests__/auth.test.ts
git commit -m "feat(cloud-api): device auth route — upsert user, grant signup bonus, issue JWT"
```

---

## Task 4: Auth middleware + credits routes + tests

**Files:**
- Create: `apps/cloud-api/src/middleware/auth.ts`
- Create: `apps/cloud-api/src/routes/credits.ts`
- Create: `apps/cloud-api/src/__tests__/credits.test.ts`

JWT validation: the JWT is signed with the *user's own* `jwt_secret` (not a global secret). To verify, we extract `sub` (user id) from the unverified payload, fetch `jwt_secret` from DB, then verify.

- [ ] **Step 1: Write failing test**

Create `apps/cloud-api/src/__tests__/credits.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { testClient } from "hono/testing";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { creditsRoute } from "../routes/credits.js";

vi.mock("../db/client.js", () => ({ sql: vi.fn() }));
import { sql } from "../db/client.js";

// Build a minimal app for testing
const app = new Hono();
app.use("/api/credits/*", authMiddleware);
app.route("/api/credits", creditsRoute);

describe("GET /api/credits/balance", () => {
  it("returns 401 without token", async () => {
    const res = await app.request("/api/credits/balance");
    expect(res.status).toBe(401);
  });

  it("returns balance with valid JWT", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode("test-user-secret-32-chars-padded!!");

    // Simulate: middleware fetches user by sub, gets jwt_secret, verifies
    const sqlMock = sql as unknown as ReturnType<typeof vi.fn>;
    sqlMock
      .mockResolvedValueOnce([{ jwt_secret: "test-user-secret-32-chars-padded!!" }])  // auth middleware lookup
      .mockResolvedValueOnce([{ balance: 42 }]);                                        // balance query

    const token = await new SignJWT({ sub: "user-uuid-123" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(secret);

    const res = await app.request("/api/credits/balance", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ balance: 42 });
  });
});

describe("GET /api/credits/history", () => {
  it("returns paginated ledger entries", async () => {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode("test-user-secret-32-chars-padded!!");
    const sqlMock = sql as unknown as ReturnType<typeof vi.fn>;
    sqlMock
      .mockResolvedValueOnce([{ jwt_secret: "test-user-secret-32-chars-padded!!" }])
      .mockResolvedValueOnce([
        { id: "e1", delta: -1, reason: "consumption", model: "openai/gpt-4o", tokens: 1000, created_at: new Date().toISOString() },
      ])
      .mockResolvedValueOnce([{ total: "1" }]);

    const token = await new SignJWT({ sub: "user-uuid-123" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(secret);

    const res = await app.request("/api/credits/history?page=1&limit=20", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.total).toBe(1);
  });
});
```

- [ ] **Step 2: Run test — confirm fail**

```bash
cd apps/cloud-api && pnpm test -- credits
```

Expected: FAIL — modules not exported yet.

- [ ] **Step 3: Implement `apps/cloud-api/src/middleware/auth.ts`**

```typescript
import type { MiddlewareHandler } from "hono";
import { jwtVerify, decodeJwt } from "jose";
import { sql } from "../db/client.js";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);

  // Decode without verification to get user id, then fetch their secret from DB
  let userId: string;
  try {
    const payload = decodeJwt(token);
    if (typeof payload.sub !== "string") throw new Error("missing sub");
    userId = payload.sub;
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }

  const [user] = await sql<{ jwt_secret: string }[]>`
    SELECT jwt_secret FROM users WHERE id = ${userId}
  `;
  if (!user) return c.json({ error: "User not found" }, 401);

  try {
    const secret = new TextEncoder().encode(user.jwt_secret);
    await jwtVerify(token, secret);
  } catch {
    return c.json({ error: "Token verification failed" }, 401);
  }

  c.set("userId", userId);
  await next();
};
```

- [ ] **Step 4: Implement `apps/cloud-api/src/routes/credits.ts`**

```typescript
import { Hono } from "hono";
import { sql } from "../db/client.js";

export const creditsRoute = new Hono<{ Variables: { userId: string } }>();

creditsRoute.get("/balance", async (c) => {
  const userId = c.get("userId");
  const [row] = await sql<{ balance: number }[]>`
    SELECT balance FROM credit_balance WHERE user_id = ${userId}
  `;
  return c.json({ balance: row?.balance ?? 0 });
});

creditsRoute.get("/history", async (c) => {
  const userId = c.get("userId");
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 20)));
  const offset = (page - 1) * limit;

  const entries = await sql<{
    id: string;
    delta: number;
    reason: string;
    model: string | null;
    tokens: number | null;
    created_at: string;
  }[]>`
    SELECT id, delta, reason, model, tokens, created_at
    FROM credit_ledger
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [countRow] = await sql<{ total: string }[]>`
    SELECT COUNT(*) AS total FROM credit_ledger WHERE user_id = ${userId}
  `;

  return c.json({ entries, total: Number(countRow?.total ?? 0) });
});
```

- [ ] **Step 5: Run tests**

```bash
cd apps/cloud-api && pnpm test -- credits
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/cloud-api/src/middleware/auth.ts apps/cloud-api/src/routes/credits.ts apps/cloud-api/src/__tests__/credits.test.ts
git commit -m "feat(cloud-api): JWT auth middleware + credits balance and history routes"
```

---

## Task 5: OpenRouter proxy route + tests

**Files:**
- Create: `apps/cloud-api/src/routes/proxy.ts`
- Create: `apps/cloud-api/src/__tests__/proxy.test.ts`

The proxy deducts credits *before* forwarding the request (pre-deduction). If balance insufficient → 402. Estimate input tokens from message character count (`chars / 4`). After response we cannot easily reconcile streaming tokens, so pre-deduction is the MVP approach.

- [ ] **Step 1: Write failing test**

Create `apps/cloud-api/src/__tests__/proxy.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { proxyRoute } from "../routes/proxy.js";

vi.mock("../db/client.js", () => ({ sql: vi.fn() }));
import { sql } from "../db/client.js";

// Mock global fetch for OpenRouter upstream
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const app = new Hono();
app.use("/api/proxy/*", authMiddleware);
app.route("/api/proxy", proxyRoute);

async function makeToken(userId = "user-uuid-123") {
  const { SignJWT } = await import("jose");
  const secret = new TextEncoder().encode("test-user-secret-32-chars-padded!!");
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secret);
}

describe("POST /api/proxy/openrouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_MASTER_KEY = "sk-or-test-key";
  });

  it("returns 402 when balance is insufficient", async () => {
    const sqlMock = sql as unknown as ReturnType<typeof vi.fn>;
    sqlMock
      .mockResolvedValueOnce([{ jwt_secret: "test-user-secret-32-chars-padded!!" }])  // auth
      .mockResolvedValueOnce([{ balance: 0 }]);                                          // balance check

    const token = await makeToken();
    const res = await app.request("/api/proxy/openrouter", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      }),
    });
    expect(res.status).toBe(402);
  });

  it("deducts credits and proxies request when balance sufficient", async () => {
    const sqlMock = sql as unknown as ReturnType<typeof vi.fn>;
    sqlMock
      .mockResolvedValueOnce([{ jwt_secret: "test-user-secret-32-chars-padded!!" }])  // auth
      .mockResolvedValueOnce([{ balance: 50 }])                                          // balance check
      .mockResolvedValueOnce(undefined)                                                   // insert ledger
      .mockResolvedValueOnce(undefined);                                                  // update balance

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: "Hi" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const token = await makeToken();
    const res = await app.request("/api/proxy/openrouter", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: "Hello" }],
      }),
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer sk-or-test-key" }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test — confirm fail**

```bash
cd apps/cloud-api && pnpm test -- proxy
```

Expected: FAIL.

- [ ] **Step 3: Implement `apps/cloud-api/src/routes/proxy.ts`**

```typescript
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { sql } from "../db/client.js";

/** Rough token estimate: 1 token ≈ 4 characters */
function estimateInputTokens(messages: Array<{ role: string; content: unknown }>): number {
  let chars = 0;
  for (const msg of messages) {
    chars += typeof msg.content === "string" ? msg.content.length : JSON.stringify(msg.content).length;
  }
  return Math.ceil(chars / 4) + 50; // +50 overhead for role tokens
}

/** Credits to deduct: 1 credit per 1000 tokens, minimum 1 */
function creditsForTokens(tokens: number): number {
  return Math.max(1, Math.ceil(tokens / 1000));
}

export const proxyRoute = new Hono<{ Variables: { userId: string } }>();

proxyRoute.post("/openrouter", async (c) => {
  const userId = c.get("userId");
  const masterKey = process.env.OPENROUTER_MASTER_KEY;
  if (!masterKey) return c.json({ error: "Proxy not configured" }, 503);

  let payload: { model: string; messages: Array<{ role: string; content: unknown }>; stream?: boolean };
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Estimate cost before forwarding
  const estimatedTokens = estimateInputTokens(payload.messages ?? []);
  const creditCost = creditsForTokens(estimatedTokens);

  // Check balance
  const [balanceRow] = await sql<{ balance: number }[]>`
    SELECT balance FROM credit_balance WHERE user_id = ${userId}
  `;
  const balance = balanceRow?.balance ?? 0;

  if (balance < creditCost) {
    return c.json({ error: "Insufficient credits", balance, required: creditCost }, 402);
  }

  // Deduct credits (append to ledger + decrement balance)
  await sql`
    INSERT INTO credit_ledger (user_id, delta, reason, model, tokens)
    VALUES (${userId}, ${-creditCost}, 'consumption', ${payload.model}, ${estimatedTokens})
  `;
  await sql`
    UPDATE credit_balance SET balance = balance - ${creditCost}, updated_at = now()
    WHERE user_id = ${userId}
  `;

  // Forward to OpenRouter
  const upstreamRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${masterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://rivonclaw.app",
      "X-Title": "RivonClaw",
    },
    body: JSON.stringify(payload),
  });

  // Stream response back to client
  const isStreaming = payload.stream === true;
  if (isStreaming && upstreamRes.body) {
    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    return stream(c, async (s) => {
      const reader = upstreamRes.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await s.write(value);
        }
      } finally {
        reader.releaseLock();
      }
    });
  }

  // Non-streaming: return body as-is
  const responseBody = await upstreamRes.text();
  return new Response(responseBody, {
    status: upstreamRes.status,
    headers: { "Content-Type": upstreamRes.headers.get("Content-Type") ?? "application/json" },
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd apps/cloud-api && pnpm test -- proxy
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cloud-api/src/routes/proxy.ts apps/cloud-api/src/__tests__/proxy.test.ts
git commit -m "feat(cloud-api): OpenRouter proxy route with credits pre-deduction"
```

---

## Task 6: Recharge stub route

**Files:**
- Create: `apps/cloud-api/src/routes/recharge.ts`

- [ ] **Step 1: Implement `apps/cloud-api/src/routes/recharge.ts`**

```typescript
import { Hono } from "hono";

export const rechargeRoute = new Hono<{ Variables: { userId: string } }>();

// Stub — returns a placeholder response. Payment integration to be added later.
rechargeRoute.post("/create", async (c) => {
  return c.json({
    orderId: null,
    status: "unavailable",
    message: "充值功能即将上线，敬请期待",
  });
});
```

- [ ] **Step 2: Register recharge route behind auth in index.ts**

Open `apps/cloud-api/src/index.ts` and add auth middleware to the recharge and credits routes:

```typescript
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { authMiddleware } from "./middleware/auth.js";
import { authRoute } from "./routes/auth.js";
import { creditsRoute } from "./routes/credits.js";
import { proxyRoute } from "./routes/proxy.js";
import { rechargeRoute } from "./routes/recharge.js";

const app = new Hono();

app.route("/api/auth", authRoute);

// Routes below require a valid JWT
app.use("/api/credits/*", authMiddleware);
app.use("/api/proxy/*", authMiddleware);
app.use("/api/recharge/*", authMiddleware);

app.route("/api/credits", creditsRoute);
app.route("/api/proxy", proxyRoute);
app.route("/api/recharge", rechargeRoute);

app.get("/health", (c) => c.json({ ok: true }));

export default app;

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3100);
  serve({ fetch: app.fetch, port }, () => {
    console.log(`cloud-api listening on port ${port}`);
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/cloud-api/src/routes/recharge.ts apps/cloud-api/src/index.ts
git commit -m "feat(cloud-api): recharge stub + wire auth middleware to all protected routes"
```

---

## Task 7: credits-client SDK

**Files:**
- Create: `packages/credits-client/package.json`
- Create: `packages/credits-client/tsconfig.json`
- Create: `packages/credits-client/src/index.ts`
- Create: `packages/credits-client/src/__tests__/client.test.ts`

This package is used by the desktop to communicate with cloud-api.

- [ ] **Step 1: Create `packages/credits-client/package.json`**

```json
{
  "name": "@rivonclaw/credits-client",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "build": "tsdown src/index.ts"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "vitest": "^3.1.1"
  }
}
```

- [ ] **Step 2: Create `packages/credits-client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write failing test**

Create `packages/credits-client/src/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCreditsClient } from "../index.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

describe("createCreditsClient", () => {
  const client = createCreditsClient("https://api.example.com");

  beforeEach(() => vi.clearAllMocks());

  it("deviceAuth: POST /api/auth/device and returns token + balance", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "jwt-abc", balance: 100 }), { status: 200 })
    );

    const result = await client.deviceAuth("device-123");
    expect(result).toEqual({ token: "jwt-abc", balance: 100 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/auth/device",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("getBalance: GET /api/credits/balance with auth header", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ balance: 42 }), { status: 200 })
    );

    const balance = await client.getBalance("jwt-token");
    expect(balance).toBe(42);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/credits/balance",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer jwt-token" }),
      })
    );
  });

  it("getBalance: throws on 401", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    );

    await expect(client.getBalance("bad-token")).rejects.toThrow("Unauthorized");
  });

  it("proxyStream: returns Response from POST /api/proxy/openrouter", async () => {
    const mockRes = new Response("data: {}\n\n", { status: 200 });
    fetchMock.mockResolvedValueOnce(mockRes);

    const res = await client.proxyStream("jwt-token", { model: "openai/gpt-4o", messages: [] });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 4: Run test — confirm fail**

```bash
cd packages/credits-client && pnpm test
```

Expected: FAIL.

- [ ] **Step 5: Implement `packages/credits-client/src/index.ts`**

```typescript
export interface LedgerEntry {
  id: string;
  delta: number;
  reason: "signup_bonus" | "consumption" | "recharge";
  model: string | null;
  tokens: number | null;
  created_at: string;
}

export interface CreditsClient {
  deviceAuth(deviceId: string): Promise<{ token: string; balance: number }>;
  getBalance(token: string): Promise<number>;
  getHistory(token: string, page?: number, limit?: number): Promise<{ entries: LedgerEntry[]; total: number }>;
  proxyStream(token: string, payload: unknown): Promise<Response>;
  createRechargeOrder(token: string, amount: number): Promise<{ orderId: string | null; status: string; message: string }>;
}

async function apiRequest<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...fetchInit } = init;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, { ...fetchInit, headers: { ...headers, ...(fetchInit.headers as Record<string, string> | undefined) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function createCreditsClient(baseUrl: string): CreditsClient {
  return {
    deviceAuth(deviceId) {
      return apiRequest(baseUrl, "/api/auth/device", {
        method: "POST",
        body: JSON.stringify({ deviceId }),
      });
    },

    async getBalance(token) {
      const data = await apiRequest<{ balance: number }>(baseUrl, "/api/credits/balance", { token });
      return data.balance;
    },

    getHistory(token, page = 1, limit = 20) {
      return apiRequest(baseUrl, `/api/credits/history?page=${page}&limit=${limit}`, { token });
    },

    async proxyStream(token, payload) {
      const res = await fetch(`${baseUrl}/api/proxy/openrouter`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      return res;
    },

    createRechargeOrder(token, amount) {
      return apiRequest(baseUrl, "/api/recharge/create", {
        method: "POST",
        token,
        body: JSON.stringify({ amount }),
      });
    },
  };
}
```

- [ ] **Step 6: Run tests**

```bash
cd packages/credits-client && pnpm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/credits-client/
git commit -m "feat(credits-client): SDK for cloud-api communication"
```

---

## Task 8: Core AccessMode type

**Files:**
- Create: `packages/core/src/access-mode.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create `packages/core/src/access-mode.ts`**

```typescript
/** Which LLM access mode the user has selected. */
export type AccessMode = "credits" | "coding-plan" | "subscription";

/** Settings key used to persist the current access mode in SQLite. */
export const ACCESS_MODE_KEY = "access_mode" as const;

/** Default mode for new installations. */
export const DEFAULT_ACCESS_MODE: AccessMode = "credits";

/** Settings key where the credits JWT is cached. */
export const CREDITS_TOKEN_KEY = "credits_token" as const;

/** Settings key where the cloud-api base URL is configured. */
export const CLOUD_API_URL_KEY = "cloud_api_url" as const;

/** Default cloud-api URL — can be overridden via the settings key. */
export const DEFAULT_CLOUD_API_URL = "https://api.rivonclaw.com" as const;
```

- [ ] **Step 2: Export from `packages/core/src/index.ts`**

Open `packages/core/src/index.ts` and add at the end:

```typescript
export type { AccessMode } from "./access-mode.js";
export {
  ACCESS_MODE_KEY,
  DEFAULT_ACCESS_MODE,
  CREDITS_TOKEN_KEY,
  CLOUD_API_URL_KEY,
  DEFAULT_CLOUD_API_URL,
} from "./access-mode.js";
```

- [ ] **Step 3: Build core to verify no type errors**

```bash
cd packages/core && pnpm build
```

Expected: builds without errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/access-mode.ts packages/core/src/index.ts
git commit -m "feat(core): add AccessMode type and credits settings keys"
```

---

## Task 9: Desktop credits API routes

Expose credits state to the panel via desktop's local HTTP server.

**Files:**
- Create: `apps/desktop/src/api-routes/credits-routes.ts`
- Modify: `apps/desktop/src/api-routes/index.ts`
- Modify: `apps/desktop/src/api-routes/api-context.ts`
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Add `@rivonclaw/credits-client` to desktop dependencies**

Open `apps/desktop/package.json` and add to the `dependencies` object:

```json
"@rivonclaw/credits-client": "workspace:*"
```

Then run:

```bash
cd apps/desktop && pnpm install
```

- [ ] **Step 2: Add `creditsClient` to `ApiContext`**

Open `apps/desktop/src/api-routes/api-context.ts`. Add this import at the top:

```typescript
import type { CreditsClient } from "@rivonclaw/credits-client";
```

Add this field to the `ApiContext` interface (after the existing `channelManager` field):

```typescript
creditsClient?: CreditsClient;
creditsToken?: () => string | undefined;
```

- [ ] **Step 3: Create `apps/desktop/src/api-routes/credits-routes.ts`**

```typescript
import type { RouteHandler } from "./api-context.js";
import { sendJson, parseBody } from "./route-utils.js";
import {
  ACCESS_MODE_KEY,
  DEFAULT_ACCESS_MODE,
  type AccessMode,
} from "@rivonclaw/core";

export const handleCreditsRoutes: RouteHandler = async (req, res, _url, pathname, ctx) => {
  const { storage, creditsClient, creditsToken, onProviderChange } = ctx;

  // GET /api/credits/balance
  if (pathname === "/api/credits/balance" && req.method === "GET") {
    const token = creditsToken?.();
    if (!token || !creditsClient) {
      sendJson(res, 200, { balance: null, mode: storage.settings.get(ACCESS_MODE_KEY) ?? DEFAULT_ACCESS_MODE });
      return true;
    }
    try {
      const balance = await creditsClient.getBalance(token);
      sendJson(res, 200, { balance, mode: storage.settings.get(ACCESS_MODE_KEY) ?? DEFAULT_ACCESS_MODE });
    } catch {
      sendJson(res, 200, { balance: null, mode: storage.settings.get(ACCESS_MODE_KEY) ?? DEFAULT_ACCESS_MODE });
    }
    return true;
  }

  // GET /api/credits/history
  if (pathname === "/api/credits/history" && req.method === "GET") {
    const token = creditsToken?.();
    if (!token || !creditsClient) {
      sendJson(res, 200, { entries: [], total: 0 });
      return true;
    }
    try {
      const data = await creditsClient.getHistory(token);
      sendJson(res, 200, data);
    } catch {
      sendJson(res, 200, { entries: [], total: 0 });
    }
    return true;
  }

  // GET /api/credits/mode
  if (pathname === "/api/credits/mode" && req.method === "GET") {
    const mode = storage.settings.get(ACCESS_MODE_KEY) ?? DEFAULT_ACCESS_MODE;
    sendJson(res, 200, { mode });
    return true;
  }

  // POST /api/credits/mode
  if (pathname === "/api/credits/mode" && req.method === "POST") {
    const body = await parseBody(req) as { mode?: string };
    const validModes: AccessMode[] = ["credits", "coding-plan", "subscription"];
    if (!body.mode || !validModes.includes(body.mode as AccessMode)) {
      sendJson(res, 400, { error: "Invalid mode. Must be one of: credits, coding-plan, subscription" });
      return true;
    }
    storage.settings.set(ACCESS_MODE_KEY, body.mode);
    onProviderChange?.({ configOnly: true });
    sendJson(res, 200, { mode: body.mode });
    return true;
  }

  // POST /api/recharge/create (stub)
  if (pathname === "/api/recharge/create" && req.method === "POST") {
    sendJson(res, 200, { orderId: null, status: "unavailable", message: "充值功能即将上线，敬请期待" });
    return true;
  }

  return false;
};
```

- [ ] **Step 4: Export from `apps/desktop/src/api-routes/index.ts`**

Add this line to `apps/desktop/src/api-routes/index.ts`:

```typescript
export { handleCreditsRoutes } from "./credits-routes.js";
```

- [ ] **Step 5: Register handler in the panel server**

Find where route handlers are called in the desktop's panel server (likely `apps/desktop/src/panel-server.ts`). Add `handleCreditsRoutes` to the list of handlers. The exact location depends on the file structure — look for where `handleSettingsRoutes`, `handleRulesRoutes`, etc. are called, and add:

```typescript
if (await handleCreditsRoutes(req, res, url, pathname, ctx)) return;
```

- [ ] **Step 6: Build desktop to verify no type errors**

```bash
cd apps/desktop && pnpm build 2>&1 | head -30
```

Expected: no TypeScript errors in the new/modified files.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/api-routes/credits-routes.ts apps/desktop/src/api-routes/index.ts apps/desktop/src/api-routes/api-context.ts apps/desktop/package.json
git commit -m "feat(desktop): credits API routes (balance, history, mode switch)"
```

---

## Task 10: Desktop credits initializer (startup)

On startup, if `access_mode === 'credits'`, authenticate with cloud-api and configure OpenClaw's openrouter provider to point at the cloud-api proxy.

**Files:**
- Create: `apps/desktop/src/credits/credits-initializer.ts`

**Important:** Before implementing, read `packages/gateway/src/config-writer.ts` to understand how custom provider base URLs are written. The goal is to write the JWT as the openrouter API key and set the openrouter `baseUrl` to the cloud-api proxy URL. If the config writer does not support per-provider `baseUrl` overrides, use the custom provider approach (add an OpenAI-compatible custom provider pointing at cloud-api).

- [ ] **Step 1: Read gateway config writer to understand provider URL config**

```bash
# In your editor, open:
packages/gateway/src/config-writer.ts
# Look for: how apiKey is injected for the openrouter provider
# Look for: whether custom baseUrl per provider is supported
# Look for: custom provider format
```

- [ ] **Step 2: Create `apps/desktop/src/credits/credits-initializer.ts`**

Use the pattern you discovered in the config writer. The code below assumes the config writer supports writing API keys to settings — adapt if needed:

```typescript
import { createLogger } from "@rivonclaw/logger";
import { getDeviceId } from "@rivonclaw/device-id";
import { createCreditsClient } from "@rivonclaw/credits-client";
import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";
import {
  ACCESS_MODE_KEY,
  CREDITS_TOKEN_KEY,
  CLOUD_API_URL_KEY,
  DEFAULT_CLOUD_API_URL,
  DEFAULT_ACCESS_MODE,
} from "@rivonclaw/core";

const log = createLogger("credits-initializer");

export interface CreditsInitResult {
  token: string | null;
  balance: number;
  client: ReturnType<typeof createCreditsClient> | null;
}

/**
 * Called at desktop startup.
 * If access_mode is 'credits', authenticates with cloud-api and configures
 * the openrouter provider to point at the cloud-api proxy with the JWT as API key.
 */
export async function initializeCredits(
  storage: Storage,
  secretStore: SecretStore,
): Promise<CreditsInitResult> {
  const mode = storage.settings.get(ACCESS_MODE_KEY) ?? DEFAULT_ACCESS_MODE;

  if (mode !== "credits") {
    return { token: null, balance: 0, client: null };
  }

  const cloudApiUrl = storage.settings.get(CLOUD_API_URL_KEY) ?? DEFAULT_CLOUD_API_URL;
  const client = createCreditsClient(cloudApiUrl);

  try {
    const deviceId = await getDeviceId();
    const { token, balance } = await client.deviceAuth(deviceId);

    // Cache token in settings for desktop API routes to read
    storage.settings.set(CREDITS_TOKEN_KEY, token);

    // Write JWT as the openrouter API key in the secret store
    // The gateway config writer reads this via the "openrouter-api-key" secret key
    await secretStore.set("openrouter-api-key", token);

    // Write cloud-api proxy URL as a custom settings override for the openrouter baseUrl.
    // This key name must match what the gateway config writer reads.
    // Convention from settings-routes.ts: provider base URL overrides are stored as
    // "<provider>-base-url" — but verify this in packages/gateway/src/config-writer.ts.
    storage.settings.set("openrouter-base-url", `${cloudApiUrl}/api/proxy/openrouter`);

    log.info(`Credits mode: authenticated, balance=${balance}`);
    return { token, balance, client };
  } catch (err) {
    log.error("Credits initialization failed:", err);
    return { token: null, balance: 0, client };
  }
}
```

> **Note for implementer:** After reading the gateway config writer, verify that:
> 1. `secretStore.set("openrouter-api-key", token)` causes the JWT to be injected as the API key.
> 2. `storage.settings.set("openrouter-base-url", ...)` is read by the config writer to override the provider base URL. If neither is true, use the custom provider registration API instead — add a custom provider entry with name "RivonClaw Credits" pointing at `${cloudApiUrl}/api/proxy/openrouter` with the JWT as the API key, and set `llm-provider` to this custom provider.

- [ ] **Step 3: Call initializer from `apps/desktop/src/main.ts`**

Find the app initialization section in `apps/desktop/src/main.ts` (look for where `storage`, `secretStore`, and gateway are initialized). Add the credits initializer call before the gateway starts:

```typescript
import { initializeCredits } from "./credits/credits-initializer.js";

// After storage and secretStore are ready, before gateway.start():
const creditsResult = await initializeCredits(storage, secretStore);

// Pass creditsClient and token accessor to ApiContext:
const ctx: ApiContext = {
  // ... existing fields ...
  creditsClient: creditsResult.client ?? undefined,
  creditsToken: creditsResult.token ? () => storage.settings.get(CREDITS_TOKEN_KEY) : undefined,
};
```

- [ ] **Step 4: Build to verify no type errors**

```bash
cd apps/desktop && pnpm build 2>&1 | head -30
```

Expected: no errors in `credits/` files.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/credits/ apps/desktop/src/main.ts
git commit -m "feat(desktop): credits initializer — authenticate and configure openrouter proxy on startup"
```

---

## Task 11: Panel credits API functions

**Files:**
- Create: `apps/panel/src/api/credits.ts`
- Modify: `apps/panel/src/api/index.ts`

- [ ] **Step 1: Create `apps/panel/src/api/credits.ts`**

```typescript
import { fetchJson } from "./client.js";
import type { AccessMode } from "@rivonclaw/core";

export interface LedgerEntry {
  id: string;
  delta: number;
  reason: "signup_bonus" | "consumption" | "recharge";
  model: string | null;
  tokens: number | null;
  created_at: string;
}

export interface CreditsInfo {
  balance: number | null;
  mode: AccessMode;
}

export function fetchCreditsInfo(): Promise<CreditsInfo> {
  return fetchJson<CreditsInfo>("/credits/balance");
}

export function fetchCreditsHistory(page = 1, limit = 20): Promise<{ entries: LedgerEntry[]; total: number }> {
  return fetchJson(`/credits/history?page=${page}&limit=${limit}`);
}

export function fetchAccessMode(): Promise<{ mode: AccessMode }> {
  return fetchJson<{ mode: AccessMode }>("/credits/mode");
}

export function setAccessMode(mode: AccessMode): Promise<{ mode: AccessMode }> {
  return fetchJson<{ mode: AccessMode }>("/credits/mode", {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export function createRechargeOrder(amount: number): Promise<{ orderId: string | null; status: string; message: string }> {
  return fetchJson("/recharge/create", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}
```

- [ ] **Step 2: Re-export from `apps/panel/src/api/index.ts`**

Add to `apps/panel/src/api/index.ts`:

```typescript
export * from "./credits.js";
```

- [ ] **Step 3: Commit**

```bash
git add apps/panel/src/api/credits.ts apps/panel/src/api/index.ts
git commit -m "feat(panel): credits API client functions"
```

---

## Task 12: Panel CreditsBalance component

Displays current balance in the sidebar for credits-mode users.

**Files:**
- Create: `apps/panel/src/components/CreditsBalance.tsx`

- [ ] **Step 1: Create `apps/panel/src/components/CreditsBalance.tsx`**

```tsx
import { useState, useEffect } from "react";
import { fetchCreditsInfo } from "../api/credits.js";

export function CreditsBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreditsInfo()
      .then((info) => {
        setBalance(info.balance);
        setMode(info.mode);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (mode !== "credits") return null;
  if (loading) return null;

  return (
    <div className="credits-balance" title="积分余额">
      <span className="credits-balance__icon">⚡</span>
      <span className="credits-balance__value">
        {balance === null ? "—" : balance.toLocaleString()}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/panel/src/components/CreditsBalance.tsx
git commit -m "feat(panel): CreditsBalance sidebar component"
```

---

## Task 13: Panel CreditsPage

**Files:**
- Create: `apps/panel/src/pages/CreditsPage.tsx`

- [ ] **Step 1: Create `apps/panel/src/pages/CreditsPage.tsx`**

```tsx
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchCreditsInfo,
  fetchCreditsHistory,
  createRechargeOrder,
  type LedgerEntry,
} from "../api/credits.js";

export function CreditsPage() {
  const { t } = useTranslation();
  const [balance, setBalance] = useState<number | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rechargeMsg, setRechargeMsg] = useState<string | null>(null);
  const limit = 20;

  const loadData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const [info, history] = await Promise.all([
        fetchCreditsInfo(),
        fetchCreditsHistory(p, limit),
      ]);
      setBalance(info.balance);
      setEntries(history.entries);
      setTotal(history.total);
      setPage(p);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(1); }, [loadData]);

  async function handleRecharge() {
    try {
      const result = await createRechargeOrder(100);
      setRechargeMsg(result.message);
    } catch (err) {
      setRechargeMsg(String(err));
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="page credits-page">
      <h1>积分中心</h1>

      <div className="credits-page__balance-card">
        <div className="credits-page__balance-label">当前积分</div>
        <div className="credits-page__balance-value">
          {balance === null ? "加载中…" : balance.toLocaleString()}
        </div>
        <button className="btn btn-primary" onClick={handleRecharge}>
          充值
        </button>
        {rechargeMsg && (
          <p className="credits-page__recharge-msg">{rechargeMsg}</p>
        )}
      </div>

      <h2>消费记录</h2>
      {loading ? (
        <p>加载中…</p>
      ) : entries.length === 0 ? (
        <p>暂无记录</p>
      ) : (
        <table className="credits-page__table">
          <thead>
            <tr>
              <th>时间</th>
              <th>变化</th>
              <th>原因</th>
              <th>模型</th>
              <th>Token</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.created_at).toLocaleString("zh-CN")}</td>
                <td className={e.delta < 0 ? "neg" : "pos"}>
                  {e.delta > 0 ? `+${e.delta}` : e.delta}
                </td>
                <td>
                  {e.reason === "signup_bonus" ? "注册赠送" :
                   e.reason === "consumption" ? "消费" : "充值"}
                </td>
                <td>{e.model ?? "—"}</td>
                <td>{e.tokens?.toLocaleString() ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div className="credits-page__pagination">
          <button disabled={page <= 1} onClick={() => loadData(page - 1)}>上一页</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => loadData(page + 1)}>下一页</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/panel/src/pages/CreditsPage.tsx
git commit -m "feat(panel): CreditsPage with balance + paginated history"
```

---

## Task 14: Panel AccessModePage + routing + Layout

**Files:**
- Create: `apps/panel/src/pages/AccessModePage.tsx`
- Modify: `apps/panel/src/App.tsx`
- Modify: `apps/panel/src/layout/Layout.tsx`

- [ ] **Step 1: Create `apps/panel/src/pages/AccessModePage.tsx`**

```tsx
import { useState, useEffect } from "react";
import { fetchAccessMode, setAccessMode } from "../api/credits.js";
import type { AccessMode } from "@rivonclaw/core";

const MODES: { id: AccessMode; label: string; desc: string }[] = [
  {
    id: "credits",
    label: "默认模型（积分）",
    desc: "新用户免费体验，消耗积分使用 AI。积分耗尽后可充值。",
  },
  {
    id: "coding-plan",
    label: "编程订阅计划",
    desc: "使用您自己的编程订阅（智谱编程、Moonshot Coding、通义编程等）。",
  },
  {
    id: "subscription",
    label: "订阅 / API Key",
    desc: "使用您自己的 Claude/Gemini 订阅或 OpenAI、Anthropic、OpenRouter 等 API Key。",
  },
];

export function AccessModePage() {
  const [current, setCurrent] = useState<AccessMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchAccessMode()
      .then((r) => setCurrent(r.mode))
      .catch(() => {});
  }, []);

  async function handleSelect(mode: AccessMode) {
    setSaving(true);
    setMsg(null);
    try {
      await setAccessMode(mode);
      setCurrent(mode);
      setMsg("切换成功，下次启动时生效。");
    } catch (err) {
      setMsg(`切换失败：${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page access-mode-page">
      <h1>接入模式</h1>
      <p>选择您希望使用的 AI 接入方式：</p>

      <div className="access-mode-page__cards">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`access-mode-page__card ${current === m.id ? "selected" : ""}`}
            onClick={() => handleSelect(m.id)}
            disabled={saving}
          >
            <div className="access-mode-page__card-label">{m.label}</div>
            <div className="access-mode-page__card-desc">{m.desc}</div>
            {current === m.id && <div className="access-mode-page__card-badge">当前</div>}
          </button>
        ))}
      </div>

      {msg && <p className="access-mode-page__msg">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Add pages to `apps/panel/src/App.tsx`**

Add two imports after the existing page imports:

```typescript
import { CreditsPage } from "./pages/CreditsPage.js";
import { AccessModePage } from "./pages/AccessModePage.js";
```

Add to the `PAGES` object:

```typescript
"/credits": CreditsPage,
"/access-mode": AccessModePage,
```

Also update `checkOnboarding` to treat credits mode as "configured" (no API key required). Find the `checkOnboarding` function and replace:

```typescript
// BEFORE:
setShowOnboarding(!hasApiKey);
```

```typescript
// AFTER:
const mode = settings["access_mode"] ?? "credits";
const isConfigured = mode === "credits" || hasApiKey;
setShowOnboarding(!isConfigured);
```

- [ ] **Step 3: Add nav entries to `apps/panel/src/layout/Layout.tsx`**

In Layout.tsx, find the `NAV_ICONS` record and add entries for the two new pages. Import any existing icon you want to reuse (e.g., `UsageIcon` for credits, `SettingsIcon` for access-mode) or use inline SVG:

```typescript
// Add to NAV_ICONS:
"/credits": <UsageIcon />,       // reuse UsageIcon or pick another
"/access-mode": <SettingsIcon />, // reuse or create new icon
```

Then find where the nav items are rendered in the sidebar and add the two new entries in the appropriate position (after `/usage`, before `/skills`):

```tsx
<NavItem path="/credits" label="积分中心" onNavigate={onNavigate} currentPath={currentPath} />
<NavItem path="/access-mode" label="接入模式" onNavigate={onNavigate} currentPath={currentPath} />
```

(Look at how existing nav items are rendered and follow the same pattern — the exact component name and props depend on the Layout implementation.)

- [ ] **Step 4: Also add CreditsBalance to Layout sidebar**

In Layout.tsx, find where the sidebar bottom section is rendered and add `<CreditsBalance />`:

```tsx
import { CreditsBalance } from "../components/CreditsBalance.js";

// In the sidebar JSX, near the bottom:
<CreditsBalance />
```

- [ ] **Step 5: Build panel to verify no type errors**

```bash
cd apps/panel && pnpm build 2>&1 | head -30
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/panel/src/pages/AccessModePage.tsx apps/panel/src/pages/CreditsPage.tsx apps/panel/src/App.tsx apps/panel/src/layout/Layout.tsx apps/panel/src/components/CreditsBalance.tsx
git commit -m "feat(panel): AccessModePage + CreditsPage + nav entries + CreditsBalance in sidebar"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Three access modes (credits / coding-plan / subscription) — Tasks 8, 9, 14
- ✅ Cloud backend with device auth + credits ledger — Tasks 1–4
- ✅ OpenRouter proxy + credit deduction — Task 5
- ✅ credits-client SDK — Task 7
- ✅ Desktop startup initialization — Task 10
- ✅ Panel UI: AccessModePage, CreditsPage, CreditsBalance — Tasks 12–14
- ✅ Recharge stub (placeholder) — Task 6
- ✅ Skills marketplace: untouched ✓
- ✅ Onboarding: credits mode skips API key check — Task 14 Step 2

**Gateway integration (Task 10):** The exact mechanism for overriding the openrouter provider base URL at runtime requires reading `packages/gateway/src/config-writer.ts`. The plan provides a best-effort implementation with a clear note to adapt based on findings.
