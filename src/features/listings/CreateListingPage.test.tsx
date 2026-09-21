// @vitest-environment jsdom
import React from 'react';
import { afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CreateListingPage } from './CreateListingPage';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), insert: vi.fn() }));
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
              eq: () => ({ order: async () => ({ data: [{ id: 'cat', name: 'Games' }], error: null }) }),
            }),
          }
        : { insert: mocks.insert },
  },
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('valida dinheiro e retoma publicação sem recriar rascunho nem reenviar fotos', async () => {
  URL.createObjectURL = vi.fn(() => 'blob:' + Math.random());
  URL.revokeObjectURL = vi.fn();
  mocks.upload.mockResolvedValue({ error: null });
  mocks.insert.mockResolvedValue({ error: null });
  let publishes = 0;
  mocks.rpc.mockImplementation(async (name: string) =>
    name === 'create_listing_draft'
      ? { data: 'listing-id', error: null }
      : ++publishes === 1
        ? { error: { message: 'Falha temporária' } }
        : { data: { slug: 'novo-item' }, error: null },
  );
  render(
    <MemoryRouter initialEntries={['/vender/novo']}>
      <Routes>
        <Route path="/vender/novo" element={<CreateListingPage />} />
        <Route path="/l/:slug" element={<p>Publicado com sucesso</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('option', { name: 'Games' });
  fireEvent.change(document.querySelector('input[type=file]')!, {
    target: { files: [1, 2, 3].map((i) => new File(['img'], i + '.webp', { type: 'image/webp' })) },
  });
  await waitFor(() => expect(document.querySelectorAll('.photo-preview img')).toHaveLength(3));
  for (const [label, value] of [
    ['Título', 'Console de videogame'],
    ['Descrição', 'Console usado em bom estado de conservação'],
    ['Valor inicial (R$)', 'abc123'],
    ['Cidade', 'São Paulo'],
    ['UF', 'SP'],
  ] as const)
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'cat' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('button', { name: 'Publicar leilão' }).closest('form')!);
  await screen.findByText('Informe um valor válido, como 1.234,50.');
  expect(mocks.rpc).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Valor inicial (R$)'), { target: { value: '150,00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar leilão' }));
  await screen.findByText(/Falha temporária/);
  fireEvent.click(screen.getByRole('button', { name: 'Publicar leilão' }));
  await screen.findByText('Publicado com sucesso');
  expect(mocks.rpc.mock.calls.filter(([name]) => name === 'create_listing_draft')).toHaveLength(1);
  expect(mocks.upload).toHaveBeenCalledTimes(3);
  const publications = mocks.rpc.mock.calls.filter(([name]) => name === 'publish_listing');
  expect(publications).toHaveLength(2);
  expect(publications[0][1]).toEqual(publications[1][1]);
  expect(publications[1][1].p_declaration_accepted).toBe(true);
});
