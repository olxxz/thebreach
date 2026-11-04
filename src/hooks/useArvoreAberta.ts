'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ancestrais } from '@/components/nav/arvore';

const CHAVE_ABERTOS = 'breach:navegacao-aberta';

/**
 * Quais galhos da árvore de navegação estão abertos. Lembra a escolha do
 * leitor entre visitas e sempre revela o caminho até a página atual.
 */
export function useArvoreAberta(pathname: string): {
  abertos: Set<string>;
  alternar: (chave: string) => void;
} {
  // Começa vazio nos dois lados para a hidratação não divergir; o que estava
  // guardado entra depois, junto com os ancestrais da página atual.
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const carregado = useRef(false);

  useEffect(() => {
    let guardado: string[] = [];
    try {
      guardado = JSON.parse(localStorage.getItem(CHAVE_ABERTOS) ?? '[]');
    } catch {
      guardado = [];
    }
    setAbertos(new Set([...guardado, ...ancestrais(pathname)]));
    carregado.current = true;
    // Só na montagem: a partir daí o efeito seguinte cuida da navegação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navegar revela o caminho até a página, sem fechar o que o leitor abriu.
  useEffect(() => {
    setAbertos((atual) => {
      const novo = new Set(atual);
      let mudou = false;
      for (const chave of ancestrais(pathname)) {
        if (!novo.has(chave)) {
          novo.add(chave);
          mudou = true;
        }
      }
      return mudou ? novo : atual;
    });
  }, [pathname]);

  useEffect(() => {
    if (!carregado.current) return;
    try {
      localStorage.setItem(CHAVE_ABERTOS, JSON.stringify([...abertos]));
    } catch {
      /* sem armazenamento: a árvore ainda funciona, só não lembra. */
    }
  }, [abertos]);

  const alternar = useCallback((chave: string) => {
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(chave)) novo.add(chave);
      return novo;
    });
  }, []);

  return { abertos, alternar };
}
