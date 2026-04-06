import { Hono } from "hono";
import { stream } from "hono/streaming";
import { sql } from "../db/client.js";

function estimateInputTokens(messages: Array<{ role: string; content: unknown }>): number {
  let chars = 0;
  for (const msg of messages) {
    chars += typeof msg.content === "string" ? msg.content.length : JSON.stringify(msg.content).length;
  }
  return Math.ceil(chars / 4) + 50;
}

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

  const estimatedTokens = estimateInputTokens(payload.messages ?? []);
  const creditCost = creditsForTokens(estimatedTokens);

  const [balanceRow] = await sql<{ balance: number }[]>`
    SELECT balance FROM credit_balance WHERE user_id = ${userId}
  `;
  const balance = balanceRow?.balance ?? 0;

  if (balance < creditCost) {
    return c.json({ error: "Insufficient credits", balance, required: creditCost }, 402);
  }

  await sql`
    INSERT INTO credit_ledger (user_id, delta, reason, model, tokens)
    VALUES (${userId}, ${-creditCost}, 'consumption', ${payload.model}, ${estimatedTokens})
  `;
  await sql`
    UPDATE credit_balance SET balance = balance - ${creditCost}, updated_at = now()
    WHERE user_id = ${userId}
  `;

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

  const responseBody = await upstreamRes.text();
  return new Response(responseBody, {
    status: upstreamRes.status,
    headers: { "Content-Type": upstreamRes.headers.get("Content-Type") ?? "application/json" },
  });
});
