import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DeliveryFailureReminderSettings } from './DeliveryFailureReminderSettings.js';
const { store }=vi.hoisted(()=>({store:{shops:[] as Array<{id:string;services:{customerService:{enabled:boolean;deliveryFailureReminderEnabled:boolean}}}>,setShopDeliveryFailureReminderEnabled:vi.fn()}}));
vi.mock('../../../store/EntityStoreProvider.js',()=>({useEntityStore:()=>store}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string)=>key})}));
beforeEach(()=>{store.shops=[{id:'s',services:{customerService:{enabled:true,deliveryFailureReminderEnabled:false}}}];store.setShopDeliveryFailureReminderEnabled.mockReset().mockResolvedValue(undefined);});
afterEach(cleanup);
it('shows default off, fixed schedule hint and saves only the delivery-failure flag',async()=>{
  render(<DeliveryFailureReminderSettings shopId="s"/>);
  const checkbox=screen.getByRole('checkbox');expect((checkbox as HTMLInputElement).checked).toBe(false);
  expect(screen.getByText('ecommerce.deliveryFailureReminder.hint')).toBeTruthy();
  fireEvent.click(checkbox);fireEvent.click(screen.getByRole('button',{name:'common.save'}));
  await waitFor(()=>expect(store.setShopDeliveryFailureReminderEnabled).toHaveBeenCalledWith('s',true));
});
it('disables the switch when customer service is off',()=>{
  store.shops[0].services.customerService.enabled=false;render(<DeliveryFailureReminderSettings shopId="s"/>);
  expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
});
it('reports save failure and permits retry',async()=>{
  store.setShopDeliveryFailureReminderEnabled.mockRejectedValueOnce(new Error('failed'));
  render(<DeliveryFailureReminderSettings shopId="s"/>);fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button'));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toBe('ecommerce.deliveryFailureReminder.saveFailed'));
  fireEvent.click(screen.getByRole('button'));await waitFor(()=>expect(store.setShopDeliveryFailureReminderEnabled).toHaveBeenCalledTimes(2));
});
