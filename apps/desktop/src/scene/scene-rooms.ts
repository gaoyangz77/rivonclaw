import {
  AFFILIATE_AGENT_ID,
  CUSTOMER_SERVICE_AGENT_ID,
  DEFAULT_AGENT_ID,
  DEFAULT_SHOP_OPERATIONS_MAX_CONCURRENT,
  SHOP_OPERATIONS_MAX_CONCURRENT_ENV,
  resolveConcurrency,
} from "@rivonclaw/core/node";
import { SCENE_ROOM_LABEL_KEYS } from "@rivonclaw/scene-contract";
import { resolveMaxActiveAffiliateAgentRuns } from "../affiliate/affiliate-inbound.js";
import { resolveCsAutomaticMaxConcurrent } from "../cs-bridge/cs-run-admission.js";

/**
 * One department floor in the office view.
 *
 * Rooms are matched on `agentId` - the second segment of an OpenClaw session
 * key - not on the channel segment after it. Customer service and affiliate
 * happen to name their department there (`agent:customer-service:cs:...`), but
 * shop operations runs on the `main` agent across every channel it talks on
 * (`agent:main:main`, `agent:main:telegram:...`, `agent:main:panel-3`), so
 * channel says nothing about which department a run belongs to.
 */
export type SceneRoomConfig = {
  id: string;
  /** i18n key resolved by the Panel; this layer stays language-free. */
  labelKey: string;
  agentId: string;
  capacity: number;
};

/** Shop operations desks. See the note on the shared constant for why this one is display-only. */
export function resolveShopOperationsCapacity(env: NodeJS.ProcessEnv = process.env): number {
  return resolveConcurrency(
    SHOP_OPERATIONS_MAX_CONCURRENT_ENV,
    DEFAULT_SHOP_OPERATIONS_MAX_CONCURRENT,
    env,
  );
}

/**
 * Rooms sized from the SAME resolvers the runtime enforces, and from the same
 * shared constants the office layout generator draws desks from.
 *
 * The three numbers are defined once, in
 * `packages/core/src/node-utils/agent-concurrency.ts`. Restating any of them
 * here would let the office show a capacity the product does not have - and
 * that failure is silent, because the renderer falls through to seats in other
 * departments rather than reporting that a room is short of chairs.
 */
export function resolveSceneRooms(): SceneRoomConfig[] {
  return [
    {
      id: "cs",
      labelKey: SCENE_ROOM_LABEL_KEYS.cs,
      agentId: CUSTOMER_SERVICE_AGENT_ID,
      capacity: resolveCsAutomaticMaxConcurrent(),
    },
    {
      id: "bd",
      labelKey: SCENE_ROOM_LABEL_KEYS.bd,
      agentId: AFFILIATE_AGENT_ID,
      capacity: resolveMaxActiveAffiliateAgentRuns(),
    },
    {
      id: "ops",
      labelKey: SCENE_ROOM_LABEL_KEYS.ops,
      // Shop operations IS the default agent: it runs the store, on whatever
      // channel the operator happens to be talking on.
      agentId: DEFAULT_AGENT_ID,
      capacity: resolveShopOperationsCapacity(),
    },
  ];
}

/**
 * Reads the agent id out of `agent:<agentId>:<rest>`.
 *
 * Three segments is the minimum real form (`agent:main:main`); anything shorter
 * is not a session key. The rest is deliberately ignored - see the note on
 * `SceneRoomConfig` for why the channel segment cannot identify a department.
 */
export function parseSessionAgentId(sessionKey: string): string | null {
  const parts = sessionKey.split(":");
  if (parts.length < 3 || parts[0] !== "agent") return null;
  return parts[1] || null;
}

/**
 * The room a session belongs to, or null when it is not department work.
 *
 * Shared by the projector and the telemetry recorder so both agree on what
 * counts as which department - the recorder writes the answer to ClickHouse in
 * place of the session key, so a disagreement would mis-file history that
 * cannot be corrected later.
 */
export function resolveRoomForSession(
  rooms: readonly SceneRoomConfig[],
  sessionKey: string | undefined,
): SceneRoomConfig | null {
  if (!sessionKey) return null;
  const agentId = parseSessionAgentId(sessionKey);
  if (!agentId) return null;
  return rooms.find((room) => room.agentId === agentId) ?? null;
}
