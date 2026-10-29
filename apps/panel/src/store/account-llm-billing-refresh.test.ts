import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyPatch, getSnapshot, isAlive } from 'mobx-state-tree';
import { entityStore } from './entity-store.js';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../api/apollo-client.js', () => ({ getClient: () => ({ query }) }));

function entitlement(allowed: boolean, usedPercent: number) {
  return {
    __typename: 'BillingEntitlementStatus', scopeType: 'ACCOUNT', scopeId: 'user', coverageScopeType: null,
    coverageScopeId: null, product: 'LLM_USAGE', allowed, code: allowed ? 'ALLOWED' : 'QUOTA_EXCEEDED',
    source: null, subscription: null, validUntil: null,
    usage: [{ __typename: 'BillingUsageStatus', metric: 'LLM_TOKEN', window: 'WEEK', usedPercent,
      remainingPercent: 100 - usedPercent, refreshAt: '2026-10-30T00:00:00.000Z' }],
  };
}
const shopStatus = { ...entitlement(true, 0), scopeType: 'SHOP', scopeId: 'shop-1', product: 'ECOM_INVENTORY', usage: [] };
// The SSE path writes the store with JSON patches; tests seed it the same way.
const setOverview = (value: unknown) => applyPatch(entityStore, { op: 'replace', path: '/billingOverview', value });
const loadedOverview = () => JSON.parse(JSON.stringify(loaded, (key, value) => key === '__typename' ? undefined : value));
const loaded = {
  accountServices: [],
  accountLlm: { planId: 'RIVONCLAW_AI_PRO', entitlement: entitlement(true, 10) },
  shops: [{ shopId: 'shop-1', shopName: 'Shop 1', customerService: shopStatus, inventory: shopStatus, affiliate: shopStatus, analytics: shopStatus }],
};

const user = (userId: string) => ({ userId, email: `${userId}@test.com`, name: null, createdAt: '2026-01-01T00:00:00.000Z', defaultRunProfileId: null, roleName: null });
// Desktop publishes identity changes as patches; tests do the same.
const setUser = (userId: string | null) =>
  applyPatch(entityStore, { op: 'replace', path: '/currentUser', value: userId ? user(userId) : null });

beforeEach(() => setUser('user-a'));
afterEach(() => {
  setOverview(null);
  setUser(null);
  query.mockReset();
});

function pendingQuery() {
  let release!: (value: unknown) => void;
  query.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
  return (allowed: boolean, usedPercent: number) =>
    release({ data: { billingOverview: { accountLlm: { planId: 'RIVONCLAW_AI_PRO', entitlement: entitlement(allowed, usedPercent) } } } });
}

it('drops account A\'s quota that arrives after switching to account B', async () => {
  setOverview(loadedOverview());
  const respond = pendingQuery();
  const pending = entityStore.refreshAccountLlmBilling();
  setUser('user-b');
  setOverview({ ...loadedOverview(), accountLlm: { planId: null, entitlement: loadedOverview().accountLlm.entitlement } });
  respond(false, 100);
  await pending;
  expect(entityStore.billingOverview!.accountLlm.entitlement).toMatchObject({ allowed: true });
  expect(entityStore.billingOverview!.accountLlm.planId).toBeNull();
});

it('does not recreate an overview after logout', async () => {
  setOverview(loadedOverview());
  const respond = pendingQuery();
  const pending = entityStore.refreshAccountLlmBilling();
  entityStore.clearAuth();
  setOverview(null);
  respond(false, 100);
  await pending;
  expect(entityStore.billingOverview).toBeNull();
});

it('drops a response from before a logout even when the same account logs back in', async () => {
  setOverview(loadedOverview());
  const respond = pendingQuery();
  const pending = entityStore.refreshAccountLlmBilling();
  entityStore.clearAuth();
  setUser('user-a');
  respond(false, 100);
  await pending;
  expect(entityStore.billingOverview!.accountLlm.entitlement.allowed).toBe(true);
});

it('skips the request entirely when no account is signed in', async () => {
  setUser(null);
  await entityStore.refreshAccountLlmBilling();
  expect(query).not.toHaveBeenCalled();
});

it('applies the returned quota immediately (no Desktop SSE) and keeps the loaded shops', async () => {
  setOverview(loadedOverview());
  query.mockResolvedValue({ data: { billingOverview: { __typename: 'BillingOverview',
    accountLlm: { __typename: 'AccountLlmBillingStatus', planId: 'RIVONCLAW_AI_PRO', entitlement: entitlement(false, 100) } } } });

  await entityStore.refreshAccountLlmBilling();

  const overview = getSnapshot(entityStore.billingOverview!)!;
  expect(overview.accountLlm.entitlement).toMatchObject({ allowed: false, code: 'QUOTA_EXCEEDED' });
  expect(overview.accountLlm.entitlement.usage[0].usedPercent).toBe(100);
  expect(overview.shops.map((shop) => shop.shopId)).toEqual(['shop-1']);
  const operation = query.mock.calls[0][0].query.definitions.find((definition: any) => definition.kind === 'OperationDefinition');
  expect(operation.name.value).toBe('AccountLlmBilling');
});

it('applies to the live overview when the overview was replaced during the request', async () => {
  setOverview(loadedOverview());
  const old = entityStore.billingOverview!;
  let release!: (value: unknown) => void;
  query.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
  const pending = entityStore.refreshAccountLlmBilling();
  setOverview(null); // logout/replace destroys the node the request started with
  setOverview(loadedOverview());
  expect(isAlive(old)).toBe(false);
  release({ data: { billingOverview: { accountLlm: { planId: null, entitlement: entitlement(false, 100) } } } });
  await pending;
  expect(entityStore.billingOverview!.accountLlm.entitlement.allowed).toBe(false);
  expect(entityStore.billingOverview!.shops).toHaveLength(1);
});

it('starts an overview when none was loaded yet', async () => {
  query.mockResolvedValue({ data: { billingOverview: { accountLlm: { planId: null, entitlement: entitlement(true, 5) } } } });
  await entityStore.refreshAccountLlmBilling();
  expect(getSnapshot(entityStore.billingOverview!)).toMatchObject({ shops: [], accountServices: [], accountLlm: { entitlement: { allowed: true } } });
});

it('fails loudly when the response has no quota', async () => {
  query.mockResolvedValue({ data: { billingOverview: null } });
  await expect(entityStore.refreshAccountLlmBilling()).rejects.toThrow('returned no accountLlm');
});
