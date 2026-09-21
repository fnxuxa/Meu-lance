import { test, expect } from '@playwright/test';
test('demo explícita, navegação e galeria sem erros', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('Demonstração: anúncios ilustrativos, sem transações reais.')).toBeVisible();
  await page.getByRole('link', { name: 'Acompanhar disputa' }).click();
  await expect(page.getByRole('heading', { name: 'iPhone 14 128GB impecável' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar lance' })).toBeDisabled();
  await expect(page.getByText('4,9 reputação')).toHaveCount(0);
  await page.getByRole('button', { name: 'Foto 2', exact: true }).click();
  await expect(page.locator('.gallery-main')).toHaveAttribute('alt', /foto 2/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('busca acompanha mudança de URL sem recarregar', async ({ page }) => {
  await page.goto('/buscar?q=iphone');
  await expect(page.locator('.grid .card')).toHaveCount(1);
  await page.getByPlaceholder('Produto, marca, cidade ou estado').fill('RTX');
  await expect(page.locator('.grid .card')).toHaveCount(1);
  await expect(page.locator('.grid')).toContainText('RTX');
  await page.getByPlaceholder('Produto, marca, cidade ou estado').fill('produto inexistente');
  await expect(page.getByRole('heading', { name: 'Nenhum leilão encontrado' })).toBeVisible();
});
test('rotas privadas e recuperação não fingem operação', async ({ page }) => {
  await page.goto('/vender/novo');
  await expect(page.getByRole('heading', { name: 'Entre para vender' })).toBeVisible();
  await page.goto('/recuperar-senha');
  await page.getByLabel('E-mail').fill('teste@example.com');
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByRole('status')).toContainText('indisponível no modo demonstração');
  await page.goto('/l/inexistente');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByText('Entre com uma conta autorizada.')).toBeVisible();
});
