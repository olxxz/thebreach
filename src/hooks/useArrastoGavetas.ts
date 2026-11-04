'use client';

import { useEffect, useRef, useState } from 'react';

export type Lado = 'nav' | 'ferramentas';

/**
 * Um gesto que começa dentro de algo que rola na horizontal — uma tabela larga,
 * um bloco de código — pertence àquilo, não à casca.
 */
function dentroDeRolagemHorizontal(alvo: EventTarget | null): boolean {
  let no = alvo instanceof Element ? alvo : null;
  while (no && no !== document.body) {
    if (no.scrollWidth > no.clientWidth + 1) {
      const overflow = getComputedStyle(no).overflowX;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
    no = no.parentElement;
  }
  return false;
}

/**
 * Ajustes do arrasto.
 *  `retidao`  — quanto o dedo tem de andar mais na horizontal do que na
 *               vertical para o gesto ser das gavetas e não da rolagem.
 *  `acordar`  — deslocamento a partir do qual se decide de quem é o gesto.
 *  `virada`   — fração da gaveta a partir da qual soltar completa a abertura.
 *  `piparote` — abaixo deste tempo o gesto vale pela direção, não pela
 *               distância: um peteleco rápido abre mesmo sem ter ido longe.
 *  `assentar` — o quanto a animação do CSS leva; passado isso o inline sai.
 */
const ARRASTO = { retidao: 1.8, acordar: 12, virada: 0.45, piparote: 320, assentar: 340 } as const;

interface Opcoes {
  /** Só em tela de dedo as laterais respondem ao arrasto. */
  ativo: boolean;
  drawer: boolean;
  tools: string;
  toggleTools: () => void;
  setDrawer: (aberto: boolean) => void;
}

/**
 * Gavetas laterais que acompanham o dedo no telefone. Devolve as referências
 * que o leiaute liga às gavetas e ao véu, e qual lado está sendo arrastado.
 */
export function useArrastoGavetas({ ativo: estreito, drawer, tools, toggleTools, setDrawer }: Opcoes) {
  // Enquanto o dedo arrasta, a gaveta é movida direto no DOM: passar 60 quadros
  // por segundo pelo React redesenharia a árvore inteira da navegação a cada
  // pixel. O estado só entra no fim, para dizer onde ela parou.
  const navRef = useRef<HTMLElement>(null);
  const ferrRef = useRef<HTMLElement>(null);
  const veuRef = useRef<HTMLButtonElement>(null);
  const [arrastando, setArrastando] = useState<Lado | null>(null);
  const assentar = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(assentar.current), []);

  /**
   * No telefone as laterais acompanham o dedo: arrastar para a direita traz a
   * navegação, para a esquerda traz as ferramentas, e a gaveta anda junto do
   * movimento em vez de saltar quando ele acaba. Ao soltar, ela completa a
   * abertura ou volta, conforme o quanto andou — ou conforme a direção, se o
   * gesto foi um peteleco rápido.
   *
   * Nada de `preventDefault` aqui: a página tem de continuar rolando na
   * vertical enquanto o dedo anda. O que separa um gesto do outro é a direção.
   */
  useEffect(() => {
    if (!estreito) return undefined;

    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let elegivel = false;
    let lado: Lado | null = null;
    let inicio = 0;
    let largura = 1;
    let progresso = 0;

    const noDe = (qual: Lado): HTMLElement | null =>
      qual === 'nav' ? navRef.current : ferrRef.current;

    /** Fora da tela, em porcentagem da própria largura. */
    const foraDe = (qual: Lado): number => (qual === 'nav' ? -102 : 102);

    /** De quem é o gesto, e de que ponto ele parte. */
    const escolher = (dx: number): { lado: Lado; inicio: number } | null => {
      const ferramentasAbertas = tools === 'open';
      if (dx > 0) {
        if (ferramentasAbertas) return { lado: 'ferramentas', inicio: 1 };
        if (!drawer) return { lado: 'nav', inicio: 0 };
        return null;
      }
      if (drawer) return { lado: 'nav', inicio: 1 };
      if (!ferramentasAbertas) return { lado: 'ferramentas', inicio: 0 };
      return null;
    };

    const pintar = (qual: Lado, p: number): void => {
      const no = noDe(qual);
      if (no) {
        no.style.transition = 'none';
        no.style.transform = `translateX(${(1 - p) * foraDe(qual)}%)`;
      }
      if (veuRef.current) {
        veuRef.current.style.transition = 'none';
        veuRef.current.style.opacity = String(p);
      }
    };

    /**
     * Solta a gaveta no destino. O inline continua mandando durante a
     * animação — devolver o controle ao CSS antes de o React escrever o novo
     * atributo faria a gaveta saltar de volta ao ponto de partida.
     */
    const soltar = (qual: Lado, abrir: boolean): void => {
      const no = noDe(qual);
      if (no) {
        no.style.transition = '';
        no.style.transform = `translateX(${abrir ? 0 : foraDe(qual)}%)`;
      }
      if (veuRef.current) {
        veuRef.current.style.transition = '';
        veuRef.current.style.opacity = abrir ? '1' : '0';
      }

      if (qual === 'nav') setDrawer(abrir);
      else if ((tools === 'open') !== abrir) toggleTools();

      window.clearTimeout(assentar.current);
      assentar.current = window.setTimeout(() => {
        if (no) no.style.transform = '';
        if (abrir && veuRef.current) veuRef.current.style.opacity = '';
        setArrastando(null);
      }, ARRASTO.assentar);
    };

    const comecar = (event: TouchEvent): void => {
      if (event.touches.length !== 1) {
        elegivel = false;
        return;
      }
      const toque = event.touches[0];
      x0 = toque.clientX;
      y0 = toque.clientY;
      t0 = Date.now();
      lado = null;
      progresso = 0;
      elegivel = !dentroDeRolagemHorizontal(event.target);
    };

    const mover = (event: TouchEvent): void => {
      if (!elegivel) return;
      const toque = event.touches[0];
      if (!toque) return;
      const dx = toque.clientX - x0;
      const dy = toque.clientY - y0;

      if (!lado) {
        if (Math.abs(dx) < ARRASTO.acordar) return;
        // Decidido de uma vez: se o dedo saiu na vertical, o gesto é da
        // rolagem e não volta a ser nosso no meio do caminho.
        if (Math.abs(dx) < Math.abs(dy) * ARRASTO.retidao) {
          elegivel = false;
          return;
        }
        // O dedo real nunca sai reto: se os primeiros pixels foram para cima ou
        // para baixo, o navegador já prendeu o gesto na rolagem e não solta
        // mais (o evento chega com `cancelable` falso). Disputar dali em diante
        // é o que fazia a gaveta andar com a página subindo junto — então aqui
        // se abre mão: ou é rolagem limpa, ou é arrasto limpo.
        if (!event.cancelable) {
          elegivel = false;
          return;
        }
        const escolha = escolher(dx);
        if (!escolha) {
          elegivel = false;
          return;
        }
        lado = escolha.lado;
        inicio = escolha.inicio;
        largura = noDe(lado)?.getBoundingClientRect().width || 1;
        window.clearTimeout(assentar.current);
        setArrastando(lado);
      }

      // Reivindicado o gesto, a página para de rolar: o dedo raramente anda
      // reto, e sem isto a leitura sobe ou desce junto com a gaveta. É por
      // causa desta linha que o `touchmove` não pode ser passivo.
      if (event.cancelable) event.preventDefault();

      const sentido = lado === 'nav' ? 1 : -1;
      progresso = Math.min(1, Math.max(0, inicio + (dx * sentido) / largura));
      pintar(lado, progresso);
    };

    const terminar = (event: TouchEvent): void => {
      const qual = lado;
      elegivel = false;
      lado = null;
      if (!qual) return;

      const toque = event.changedTouches[0];
      const dx = toque ? toque.clientX - x0 : 0;
      const avanco = dx * (qual === 'nav' ? 1 : -1);
      const piparote = Date.now() - t0 < ARRASTO.piparote && Math.abs(avanco) > 24;
      soltar(qual, piparote ? avanco > 0 : progresso > ARRASTO.virada);
    };

    const cancelar = (): void => {
      const qual = lado;
      elegivel = false;
      lado = null;
      if (qual) soltar(qual, inicio === 1);
    };

    document.addEventListener('touchstart', comecar, { passive: true });
    document.addEventListener('touchmove', mover, { passive: false });
    document.addEventListener('touchend', terminar, { passive: true });
    document.addEventListener('touchcancel', cancelar, { passive: true });
    return () => {
      document.removeEventListener('touchstart', comecar);
      document.removeEventListener('touchmove', mover);
      document.removeEventListener('touchend', terminar);
      document.removeEventListener('touchcancel', cancelar);
    };
  }, [estreito, drawer, tools, toggleTools, setDrawer]);

  return { navRef, ferrRef, veuRef, arrastando };
}
