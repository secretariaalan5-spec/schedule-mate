import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

const RELOAD_GUARD_KEY = 'pwa-sw-reload-guard';

export default function PWAHandler() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // No-op outside production builds (see vite.config.ts `disable`).
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Official recommended pattern: periodically ask the browser to
      // re-check for a new SW in the background. No manual polling of
      // visibilitychange/controllerchange — that duplicated the library's
      // own reload logic and could trigger reload loops.
      setInterval(() => {
        void registration.update();
      }, 60 * 60 * 1000); // hourly
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.success('App pronto para uso offline!', {
        description: 'Você pode acessar o sistema mesmo sem internet.',
        duration: 5000,
      });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (!needRefresh) return;

    // Guard against reload loops: only reload once per new SW activation.
    // updateServiceWorker(true) already reloads the page once the new SW
    // takes control; we just make sure it can't retrigger itself.
    if (sessionStorage.getItem(RELOAD_GUARD_KEY) === '1') {
      setNeedRefresh(false);
      return;
    }
    sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
    void updateServiceWorker(true);
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
