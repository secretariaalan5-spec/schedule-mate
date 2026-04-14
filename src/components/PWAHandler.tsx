import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PWAHandler() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

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
      toast('Nova versão disponível!', {
        description: 'Clique para atualizar e obter as melhorias mais recentes.',
        action: {
          label: 'Atualizar Agora',
          onClick: () => updateServiceWorker(true),
        },
        duration: 10000,
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
