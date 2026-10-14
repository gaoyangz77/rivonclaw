import { afterEach, expect, it, vi } from 'vitest';
import { applySnapshot, isAlive } from 'mobx-state-tree';
import { entityStore } from './entity-store.js';
const { mutate }=vi.hoisted(()=>({mutate:vi.fn()}));
vi.mock('../api/apollo-client.js',()=>({getClient:()=>({mutate})}));
const snapshot={id:'s',platform:'TIKTOK_SHOP',platformShopId:'platform',shopName:'Store',accessTokenExpiresAt:null,refreshTokenExpiresAt:null,services:{customerService:{enabled:true,pickupReminderEnabled:false}}};
afterEach(()=>{applySnapshot(entityStore.shops as any,[]);mutate.mockReset();});
it('ingests returned settings immediately without waiting for Desktop SSE',async()=>{
  applySnapshot(entityStore.shops as any,[snapshot]);mutate.mockResolvedValue({data:{updateShop:{...snapshot,__typename:'Shop',services:{customerService:{...snapshot.services.customerService,pickupReminderEnabled:true,__typename:'CustomerServiceSettings'}}}}});
  await entityStore.setShopPickupReminderEnabled('s',true);
  expect(entityStore.shops[0].services?.customerService?.pickupReminderEnabled).toBe(true);
  expect(mutate.mock.calls[0][0].variables).toEqual({id:'s',input:{services:{customerService:{pickupReminderEnabled:true}}}});
});
it('relooks up the live shop after the mutation instead of retaining a destroyed MST node',async()=>{
  applySnapshot(entityStore.shops as any,[snapshot]);const old=entityStore.shops[0];let release!:(value:unknown)=>void;
  mutate.mockImplementation(()=>new Promise(resolve=>{release=resolve;}));const pending=entityStore.setShopPickupReminderEnabled('s',true);
  applySnapshot(entityStore.shops as any,[]);expect(isAlive(old)).toBe(false);applySnapshot(entityStore.shops as any,[snapshot]);
  release({data:{updateShop:{...snapshot,services:{customerService:{enabled:true,pickupReminderEnabled:true}}}}});await pending;
  expect(entityStore.shops[0].services?.customerService?.pickupReminderEnabled).toBe(true);
});
