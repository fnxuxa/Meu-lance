// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LiveBidStage } from './LiveBidStage';
import { placeBid, autoWatch } from './api';
vi.mock('./api', () => ({ placeBid: vi.fn(), autoWatch: vi.fn().mockResolvedValue(undefined) }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
describe('confirmação de lance', () => {
  it('não envia ao apenas selecionar valor e preserva chave em retry', async () => {
    vi.mocked(placeBid).mockRejectedValueOnce({ message: 'Falha de rede' }).mockResolvedValueOnce({});
    renderWithClient(<LiveBidStage listingId="auction" initialPrice={10000} initialCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mínimo' }));
    expect(placeBid).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar lance' }));
    await screen.findByText('Falha de rede');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar lance' }));
    await waitFor(() => expect(placeBid).toHaveBeenCalledTimes(2));
    expect(vi.mocked(placeBid).mock.calls[0]).toEqual(vi.mocked(placeBid).mock.calls[1]);
    expect(vi.mocked(placeBid).mock.calls[0][1]).toBe(10000);
    await waitFor(() => expect(autoWatch).toHaveBeenCalledWith('auction'));
  });
  it('bloqueia envio em demonstração', () => {
    renderWithClient(<LiveBidStage listingId="demo" initialPrice={10000} disabled />);
    expect((screen.getByRole('button', { name: 'Confirmar lance' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
