import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import { App } from './app/App';
import { registerPwa } from './lib/pwa';
import './styles.css';

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } });
// VITE_ROUTER=hash serve para hospedar o app em subcaminhos/previews estáticos; em produção usa BrowserRouter.
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <Router>
        <App />
      </Router>
      <Analytics />
    </QueryClientProvider>
  </React.StrictMode>,
);

if (import.meta.env.PROD && import.meta.env.VITE_ROUTER !== 'hash') {
  window.addEventListener('load', () => void registerPwa().catch(() => undefined));
}
