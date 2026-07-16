import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

export default function PWAHandler() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegistered(r) {
      console.log('SW Registered:', r);
      void r?.update();
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });
  const isReloading = useRef(false);

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
    if (needRefresh) {
      void updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const reloadWithNewVersion = () => {
      if (isReloading.current) return;
      isReloading.current = true;
      window.location.reload();
    };
    const checkForUpdate = () => {
      if (document.visibilityState !== 'visible') return;
      void navigator.serviceWorker.getRegistration().then(registration => registration?.update());
    };

    navigator.serviceWorker.addEventListener('controllerchange', reloadWithNewVersion);
    document.addEventListener('visibilitychange', checkForUpdate);
    checkForUpdate();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', reloadWithNewVersion);
      document.removeEventListener('visibilitychange', checkForUpdate);
    };
  }, []);

  return null;
}
