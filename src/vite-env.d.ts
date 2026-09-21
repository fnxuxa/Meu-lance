/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_MP_PUBLIC_KEY?: string;
  readonly VITE_ROUTER?: 'hash' | 'browser';
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
