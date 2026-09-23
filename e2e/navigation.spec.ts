import { test, expect } from '@playwright/test';
const noHorizontalScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('demo explícita, navegação e galeria sem erros', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('Demonstração: anúncio ilustrativo, sem transações reais.')).toBeVisible();
  await page.locator('.grid .card').first().click();
  await expect(page.getByRole('heading', { name: 'iPhone 14 128GB impecável' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 3000 }).toBe(0);
  await expect(page.getByRole('button', { name: 'Confirmar lance' })).toBeDisabled();
  await expect(page.getByText('4,9 reputação')).toHaveCount(0);
  await page.getByRole('button', { name: 'Foto 2', exact: true }).click();
  await expect(page.locator('.gallery-main')).toHaveAttribute('alt', /foto 2/);
  await page.getByRole('button', { name: 'Próxima foto' }).click();
  await expect(page.locator('.gallery-main')).toHaveAttribute('alt', /foto 3/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/l\/iphone-14-128gb$/);
  await expect(page.locator('#ld-product')).toHaveCount(1);
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('busca acompanha a URL, ignora acentos e aplica filtros', async ({ page }) => {
  await page.goto('/buscar?q=iphone');
  await expect(page.locator('.grid .card')).toHaveCount(1);
  const input = page.getByPlaceholder('Produto, marca, cidade ou estado');
  await input.fill('sao paulo');
  await expect(page.locator('.grid .card')).toHaveCount(1);
  await expect(page.getByText('1 leilão encontrado')).toBeVisible();
  await input.fill('produto inexistente');
  await expect(page.getByRole('heading', { name: 'Nenhum leilão encontrado' })).toBeVisible();
  await input.fill('');
  await page.getByLabel('Categoria').selectOption('pc-games');
  await expect(page).toHaveURL(/cat=pc-games/);
  await expect(page.locator('.grid .card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.locator('.grid .card')).toHaveCount(1);
});

test('categorias, páginas institucionais e 404', async ({ page }) => {
  await page.goto('/c/celulares');
  await expect(page.getByRole('heading', { name: 'Celulares em leilão' })).toBeVisible();
  await expect(page.locator('.grid .card')).toHaveCount(1);
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.goto('/c/nao-existe');
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.goto('/regras-de-leilao');
  await expect(page.getByRole('heading', { name: 'Regras de leilão' })).toBeVisible();
  await expect(page.getByText('ainda não revisado por advogado')).toBeVisible();
  await page.goto('/ajuda');
  await page.getByText('O que é o lance automático?').click();
  await expect(page.getByText('Ninguém vê o seu teto.')).toBeVisible();
  await page.goto('/privacidade');
  await expect(page.getByRole('heading', { name: 'Política de Privacidade' })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
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
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.goto('/admin');
  await expect(page.getByText('Entre com uma conta autorizada.')).toBeVisible();
});
