import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PickupReminderSettings } from './PickupReminderSettings.js';
const { store }=vi.hoisted(()=>({store:{shops:[] as Array<{id:string;services:{customerService:{enabled:boolean;pickupReminderEnabled:boolean}}}>,setShopPickupReminderEnabled:vi.fn()}}));
vi.mock('../../../store/EntityStoreProvider.js',()=>({useEntityStore:()=>store}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
beforeEach(()=>{store.shops=[{id:'s',services:{customerService:{enabled:true,pickupReminderEnabled:false}}}];store.setShopPickupReminderEnabled.mockReset().mockResolvedValue(undefined);});
afterEach(cleanup);
it('shows default off, fixed schedule hint and saves only the pickup flag',async()=>{
  render(<PickupReminderSettings shopId="s"/>);
  const checkbox=screen.getByRole('checkbox');expect((checkbox as HTMLInputElement).checked).toBe(false);
  expect(screen.getByText('ecommerce.pickupReminder.hint')).toBeTruthy();
  fireEvent.click(checkbox);fireEvent.click(screen.getByRole('button',{name:'common.save'}));
  await waitFor(()=>expect(store.setShopPickupReminderEnabled).toHaveBeenCalledWith('s',true));
});
it('disables the switch when customer service is off',()=>{
  store.shops[0].services.customerService.enabled=false;render(<PickupReminderSettings shopId="s"/>);
  expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
});
it('reports save failure and permits retry',async()=>{
  store.setShopPickupReminderEnabled.mockRejectedValueOnce(new Error('failed'));
  render(<PickupReminderSettings shopId="s"/>);fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button'));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toBe('ecommerce.pickupReminder.saveFailed'));
  fireEvent.click(screen.getByRole('button'));await waitFor(()=>expect(store.setShopPickupReminderEnabled).toHaveBeenCalledTimes(2));
});
