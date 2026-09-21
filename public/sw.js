// Service worker do MeuLance: shell offline + notificações push.
const CACHE = 'meulance-reviewed-v3';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith('meulance-') && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, fontes etc. vão direto à rede
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/')));
    return;
  }
  // estáticos com hash no nome (/assets/*): cache primeiro
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            if (res.ok)
              caches
                .open(CACHE)
                .then((c) => c.put(req, copy))
                .catch(() => undefined);
            return res;
          }),
      ),
    );
  }
});

self.addEventListener('push', (e) => {
  let d = { title: 'MeuLance', body: 'Você tem uma atualização.', url: '/' };
  try {
    d = { ...d, ...(e.data ? e.data.json() : {}) };
  } catch {
    /* payload inválido: usa o padrão */
  }
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: d.url },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  let target = '/';
  try {
    const url = new URL(e.notification.data?.url || '/', self.location.origin);
    if (url.origin === self.location.origin) target = url.href;
  } catch {
    /* URL inválida abre home */
  }
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => 'focus' in w);
      if (open) {
        open.navigate(target);
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
