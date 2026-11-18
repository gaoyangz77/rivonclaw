import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GQL } from '@rivonclaw/core';
import { MessageAutoTranslationSettings } from './MessageAutoTranslationSettings.js';
const { store } = vi.hoisted(() => ({ store: { shops: [] as Array<{ id: string; services: { customerService: { enabled: boolean; messageAutoTranslation: string } } }>, setShopMessageAutoTranslation: vi.fn() } }));
vi.mock('../../../store/EntityStoreProvider.js', () => ({ useEntityStore: () => store }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const key = (name: string) => `ecommerce.messageAutoTranslation.${name}`;
beforeEach(() => { store.shops = [{ id: 's', services: { customerService: { enabled: false, messageAutoTranslation: 'OFF' } } }]; store.setShopMessageAutoTranslation.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);
it('is usable while AI customer service is off and saves the chosen level', async () => {
  render(<MessageAutoTranslationSettings shopId="s" />);
  const trigger = screen.getByRole('button', { name: key('field') });
  expect((trigger as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByText(key('off'))).toBeTruthy();
  expect((screen.getByRole('button', { name: 'common.save' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(trigger);
  fireEvent.click(screen.getByText(key('escalated')));
  fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
  await waitFor(() => expect(store.setShopMessageAutoTranslation).toHaveBeenCalledWith('s', GQL.CustomerServiceMessageAutoTranslation.Escalated));
});
it('warns that translating every conversation consumes many tokens', () => {
  store.shops[0].services.customerService.messageAutoTranslation = 'ALL';
  render(<MessageAutoTranslationSettings shopId="s" />);
  expect(screen.getByText(key('allHint'))).toBeTruthy();
});
it('reports save failure and permits retry', async () => {
  store.setShopMessageAutoTranslation.mockRejectedValueOnce(new Error('failed'));
  render(<MessageAutoTranslationSettings shopId="s" />);
  fireEvent.click(screen.getByRole('button', { name: key('field') }));
  fireEvent.click(screen.getByText(key('all')));
  fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(key('saveFailed')));
  fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
  await waitFor(() => expect(store.setShopMessageAutoTranslation).toHaveBeenCalledTimes(2));
});
