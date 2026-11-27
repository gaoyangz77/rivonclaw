import { createClient, type Client } from "graphql-ws";
import {
  ADS_OAUTH_COMPLETE_SUBSCRIPTION,
  AFFILIATE_ACTION_PROPOSAL_CHANGED_SUBSCRIPTION,
  AFFILIATE_ESCALATION_CHANGED_SUBSCRIPTION,
  AFFILIATE_OUTREACH_ACCOUNT_CONNECTED_SUBSCRIPTION,
  AFFILIATE_WORK_ITEM_CHANGED_SUBSCRIPTION,
  CS_CONVERSATION_CHANGED_SUBSCRIPTION,
  CS_ESCALATION_EVENT_SUBSCRIPTION,
  INIT_ADS_ADVERTISERS_QUERY,
  OAUTH_COMPLETE_SUBSCRIPTION,
  SHOP_UPDATED_SUBSCRIPTION,
} from "@rivonclaw/core";
import type { HostEventName } from "../host-adapter.js";
import type { WebSession } from "./web-session.js";
import type { GraphQLRequester } from "./web-graphql.js";
import type { WebHostStore } from "./web-bootstrap.js";

const AFFILIATE_WORKBENCH_CHANGED_SUBSCRIPTION =
  "subscription AffiliateWorkbenchChanged { affiliateWorkbenchChanged { creatorRelationshipId shopIds } }";

type Emit = (event: HostEventName, payload: unknown) => void;

interface SubscriptionSpec {
  /** Root field of the subscription payload. */
  field: string;
  query: string;
  variables?: (ctx: SubscriptionContext) => Record<string, unknown> | undefined;
  /** Store writes and the event(s) this payload becomes. */
  handle: (payload: any, ctx: SubscriptionContext) => void | Promise<void>;
}

interface SubscriptionContext {
  store: WebHostStore;
  request: GraphQLRequester;
  emit: Emit;
}

/**
 * Backend subscription -> store write -> host event, as
 * `apps/desktop/src/app/auth-runtime.ts` does it, minus the Desktop-only
 * side effects (device dispatch, log upload, presence probes).
 */
export const SUBSCRIPTION_SPECS: SubscriptionSpec[] = [
  {
    field: "oauthComplete",
    query: OAUTH_COMPLETE_SUBSCRIPTION,
    handle(payload, { store, emit }) {
      if (payload.shops?.length) store.upsertShopsFromGraphQL(payload.shops, "oauth-complete");
      emit("oauth-complete", payload);
    },
  },
  {
    field: "shopUpdated",
    query: SHOP_UPDATED_SUBSCRIPTION,
    handle(shop, { store, emit }) {
      store.ingestGraphQLResponse({ shopUpdated: shop });
      emit("shop-updated", { shopId: shop.id, shopName: shop.shopName ?? shop.id });
    },
  },
  {
    field: "adsOAuthComplete",
    query: ADS_OAUTH_COMPLETE_SUBSCRIPTION,
    async handle(payload, { store, request, emit }) {
      store.ingestGraphQLResponse(await request(INIT_ADS_ADVERTISERS_QUERY));
      emit("ads-oauth-complete", payload);
    },
  },
  {
    field: "affiliateOutreachAccountConnected",
    query: AFFILIATE_OUTREACH_ACCOUNT_CONNECTED_SUBSCRIPTION,
    handle: (payload, { emit }) => emit("affiliate-outreach-account-connected", payload),
  },
  {
    field: "csEscalationEvent",
    query: CS_ESCALATION_EVENT_SUBSCRIPTION,
    handle: (delivery, { emit }) => emit("cs-escalation-event", { delivery }),
  },
  {
    field: "csConversationChanged",
    query: CS_CONVERSATION_CHANGED_SUBSCRIPTION,
    variables: ({ store }) => ({ shopIds: store.shopIds() }),
    handle: (conversation, { emit }) => emit("cs-conversation-changed", { conversation }),
  },
  {
    field: "affiliateWorkItemChanged",
    query: AFFILIATE_WORK_ITEM_CHANGED_SUBSCRIPTION,
    handle: (workItem, { emit }) => emit("affiliate-work-item-changed", { workItem }),
  },
  {
    field: "affiliateActionProposalChanged",
    query: AFFILIATE_ACTION_PROPOSAL_CHANGED_SUBSCRIPTION,
    handle: (proposal, { emit }) => emit("affiliate-action-proposal-changed", { proposal }),
  },
  {
    field: "affiliateWorkbenchChanged",
    query: AFFILIATE_WORKBENCH_CHANGED_SUBSCRIPTION,
    handle: (change, { emit }) => emit("affiliate-workbench-changed", change),
  },
  {
    field: "affiliateEscalationChanged",
    query: AFFILIATE_ESCALATION_CHANGED_SUBSCRIPTION,
    handle: (change, { emit }) => emit("affiliate-escalation-changed", { change }),
  },
];

export interface WebSubscriptions {
  /** (Re)open every subscription. Safe to call again after the shop list changes. */
  start(): void;
  stop(): void;
}

export function createWebSubscriptions(options: {
  wsUrl: string | (() => string);
  session: WebSession;
  store: WebHostStore;
  request: GraphQLRequester;
  emit: Emit;
  /** After a dropped connection comes back: state may have changed while it was down. */
  onReconnected: () => void;
  createClientImpl?: typeof createClient;
}): WebSubscriptions {
  const make = options.createClientImpl ?? createClient;
  let client: Client | null = null;
  let disposers: Array<() => void> = [];
  let everConnected = false;

  function open(): Client {
    if (client) return client;
    client = make({
      url: options.wsUrl,
      lazy: true,
      retryAttempts: Infinity,
      connectionParams: async () => {
        const token = await options.session.getAccessToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
      on: {
        connected: () => {
          if (everConnected) options.onReconnected();
          everConnected = true;
        },
      },
    });
    return client;
  }

  function stop(): void {
    for (const dispose of disposers) dispose();
    disposers = [];
  }

  return {
    start() {
      stop();
      const ws = open();
      const ctx: SubscriptionContext = {
        store: options.store,
        request: options.request,
        emit: options.emit,
      };
      for (const spec of SUBSCRIPTION_SPECS) {
        const variables = spec.variables?.(ctx);
        const dispose = ws.subscribe<Record<string, unknown>>(
          { query: spec.query, variables },
          {
            next(result) {
              const payload = result.data?.[spec.field];
              if (result.errors?.length || !payload) {
                console.error(`[web-host] subscription ${spec.field} returned no payload`, result);
                return;
              }
              Promise.resolve(spec.handle(payload, ctx)).catch((error) =>
                console.error(`[web-host] handling ${spec.field} failed`, error),
              );
            },
            error: (error) => console.error(`[web-host] subscription ${spec.field} failed`, error),
            complete: () => {},
          },
        );
        disposers.push(dispose);
      }
    },
    stop() {
      stop();
      void client?.dispose();
      client = null;
      everConnected = false;
    },
  };
}
