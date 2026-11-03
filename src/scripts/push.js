const keyBytes = (value) => {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

export const pushable = () =>
  Boolean(
    'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      Notification.permission !== 'denied',
  );

export const enablePush = async (key, extra) => {
  if (!key || !pushable()) return false;

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      }));

    const response = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...subscription.toJSON(), ...extra }),
    });
    return response.ok;
  } catch {
    return false;
  }
};
