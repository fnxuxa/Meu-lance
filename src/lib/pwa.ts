export async function registerPwa() {
  if ('serviceWorker' in navigator) await navigator.serviceWorker.register('/sw.js');
}
export async function enablePush() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}
