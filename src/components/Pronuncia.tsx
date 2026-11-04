'use client';

import { useEffect } from 'react';

/**
 * Toca as pronúncias. O markdown vira HTML no build, sem script; os botões
 * `.pronuncia` só carregam a URL do áudio em `data-audio`. Um único ouvinte no
 * documento cuida de todos, e um único áudio toca por vez.
 */
export function Pronuncia() {
  useEffect(() => {
    const audio = new Audio();
    let atual: HTMLElement | null = null;

    const parar = (): void => {
      atual?.removeAttribute('data-tocando');
      atual = null;
    };

    const onClick = (event: MouseEvent): void => {
      const botao = (event.target as Element | null)?.closest<HTMLElement>('.pronuncia[data-audio]');
      if (!botao) return;
      event.preventDefault();
      if (atual === botao) {
        audio.pause();
        parar();
        return;
      }
      parar();
      audio.src = botao.dataset.audio ?? '';
      audio.currentTime = 0;
      audio
        .play()
        .then(() => {
          atual = botao;
          botao.setAttribute('data-tocando', '');
        })
        .catch(parar);
    };

    audio.addEventListener('ended', parar);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      audio.removeEventListener('ended', parar);
      audio.pause();
    };
  }, []);

  return null;
}
