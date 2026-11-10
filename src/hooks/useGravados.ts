'use client';

import { useEffect, useState } from 'react';
import { EVENTO_GRAVADOS, listarGravados, type Gravado } from '@/lib/breach/recentes';

/**
 * O que este navegador gravou e o site ainda não publicou — atualizado na
 * hora, quando outra página (ou outra aba) grava ou dispensa alguma coisa.
 */
export function useGravados(geradoEm: string, ligado: boolean): Array<{ path: string; gravado: Gravado }> {
  const [lista, setLista] = useState<Array<{ path: string; gravado: Gravado }>>([]);
  useEffect(() => {
    if (!ligado) {
      setLista([]);
      return;
    }
    const ler = (): void => setLista(listarGravados(geradoEm));
    ler();
    const naOutraAba = (event: StorageEvent): void => {
      if (event.key?.startsWith('breach:gravado')) ler();
    };
    window.addEventListener(EVENTO_GRAVADOS, ler);
    window.addEventListener('storage', naOutraAba);
    return () => {
      window.removeEventListener(EVENTO_GRAVADOS, ler);
      window.removeEventListener('storage', naOutraAba);
    };
  }, [geradoEm, ligado]);
  return lista;
}
