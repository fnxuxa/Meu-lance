// @vitest-environment jsdom
import React from 'react';
import { afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateListingPage } from './CreateListingPage';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), insert: vi.fn(), update: vi.fn() }));
vi.mock('../auth/useSession', () => ({ useSession: () => ({ user: { id: 'seller' }, loading: false }) }));
vi.mock('../../lib/images', () => ({ compressListingImage: async (file: File) => file }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    storage: { from: () => ({ upload: mocks.upload }) },
    from: (table: string) =>
      table === 'categories'
        ? {
            select: () => ({
              eq: () => ({
                order: async () => ({ data: [{ id: 'cat', name: 'Games', slug: 'pc-games' }], error: null }),
              }),
            }),
          }
        : table === 'app_config'
          ? {
              select: () => ({
                in: async () => ({
                  data: [
                    { key: 'buyer_fee_bps', value: 300 },
                    {
                      key: 'condition_checklists',
                      value: {
                        'pc-games': [
                          { key: 'powers_on', label: 'Liga e funciona normalmente' },
                          { key: 'ports_ok', label: 'Todas as portas funcionam' },
                        ],
                      },
                    },
                  ],
                  error: null,
                }),
              }),
            }
          : table === 'profiles'
            ? {
                select: () => ({
                  eq: () => ({
                    single: async () => ({
                      data: { identity_verified_at: '2026-01-01T00:00:00Z' },
                      error: null,
                    }),
                  }),
                }),
              }
            : { insert: mocks.insert, update: () => ({ eq: mocks.update }) },
  },
}));
function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('valida dinheiro e retoma publicação sem recriar rascunho nem reenviar fotos', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:' + Math.random());
  URL.revokeObjectURL = vi.fn();
  mocks.upload.mockResolvedValue({ error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.update.mockResolvedValue({ error: null });
  let publishes = 0;
  mocks.rpc.mockImplementation(async (name: string) =>
    name === 'create_listing_draft'
      ? { data: 'listing-id', error: null }
      : name !== 'publish_listing'
        ? { data: null, error: null }
        : ++publishes === 1
          ? { error: { message: 'Falha temporária' } }
          : { data: { slug: 'novo-item' }, error: null },
  );
  renderWithProviders(
    <MemoryRouter initialEntries={['/vender/novo']}>
      <Routes>
        <Route path="/vender/novo" element={<CreateListingPage />} />
        <Route path="/l/:slug" element={<p>Publicado com sucesso</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('option', { name: 'Games' });
  fireEvent.change(document.querySelector('input[data-kind=regular]')!, {
    target: { files: [1, 2, 3].map((i) => new File(['img'], i + '.webp', { type: 'image/webp' })) },
  });
  await waitFor(() => expect(document.querySelectorAll('.photo-preview img')).toHaveLength(3));
  for (const [label, value] of [
    ['Título', 'Console de videogame'],
    ['Descrição', 'Console usado em bom estado de conservação'],
    ['Valor inicial (R$)', 'abc123'],
    ['UF', 'SP'],
  ] as const)
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await screen.findByRole('option', { name: 'São Paulo' });
  fireEvent.change(screen.getByLabelText('Cidade'), { target: { value: 'São Paulo' } });
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat' } });
  for (const cb of screen.getAllByRole('checkbox')) fireEvent.click(cb);
  const form = screen.getByRole('button', { name: 'Publicar anúncio' }).closest('form')!;
  fireEvent.submit(form);
  await screen.findByText('Responda todas as perguntas do checklist de funcionamento.');
  fireEvent.click(
    within(screen.getByRole('radiogroup', { name: 'Liga e funciona normalmente' })).getByLabelText('Sim'),
  );
  fireEvent.click(
    within(screen.getByRole('radiogroup', { name: 'Todas as portas funcionam' })).getByLabelText('Não'),
  );
  fireEvent.submit(form);
  await screen.findByText('Você marcou algum item com "Não": descreva o defeito.');
  fireEvent.change(screen.getByLabelText(/Defeitos ou marcas de uso/), {
    target: { value: 'Porta HDMI com mau contato' },
  });
  fireEvent.submit(form);
  await screen.findByText('Adicione pelo menos 1 foto do defeito.');
  fireEvent.change(document.querySelector('input[data-kind=defect]')!, {
    target: { files: [new File(['img'], 'defeito.webp', { type: 'image/webp' })] },
  });
  await waitFor(() => expect(document.querySelectorAll('.photo-preview img')).toHaveLength(4));
  fireEvent.submit(form);
  await screen.findByText('Informe um valor válido, como 1.234,50.');
  expect(mocks.rpc.mock.calls.filter(([name]) => name !== 'suggest_start_price')).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Valor inicial (R$)'), { target: { value: '150,00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar anúncio' }));
  await screen.findByText(/Falha temporária/);
  fireEvent.click(screen.getByRole('button', { name: 'Publicar anúncio' }));
  await screen.findByText('Publicado com sucesso');
  expect(mocks.rpc.mock.calls.filter(([name]) => name === 'create_listing_draft')).toHaveLength(1);
  expect(mocks.upload).toHaveBeenCalledTimes(4);
  expect(mocks.insert.mock.calls.at(-1)?.[0]).toMatchObject({ sort_order: 3, is_defect: true });
  const report = mocks.rpc.mock.calls.find(([name]) => name === 'set_listing_condition_report');
  expect(report?.[1].p_checklist).toEqual({ powers_on: 'yes', ports_ok: 'no' });
  const publications = mocks.rpc.mock.calls.filter(([name]) => name === 'publish_listing');
  expect(publications).toHaveLength(2);
  expect(publications[0][1]).toEqual(publications[1][1]);
  expect(publications[1][1].p_declaration_accepted).toBe(true);
});
