'use client';

import { useEffect } from 'react';

/** Atalhos de teclado globais: `/` ou Ctrl/⌘+K abre a busca; Ctrl+Alt+A, o acesso de edição. */
export function useAtalhos(abrirBusca: () => void, abrirAcesso: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const digitando =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (digitando) return;

      // `event.code` em vez de `event.key`: em alguns layouts Ctrl+Alt+A vira
      // caractere morto e `key` não chega a valer 'a'.
      if (event.ctrlKey && event.altKey && event.code === 'KeyA') {
        event.preventDefault();
        abrirAcesso();
        return;
      }
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        abrirBusca();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [abrirBusca, abrirAcesso]);

}
