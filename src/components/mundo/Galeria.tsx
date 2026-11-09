'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import type { Ilustracao } from '@/lib/breach/mundo';

interface Props {
  imagens: Ilustracao[];
  categorias: Array<{ slug: string; title: string }>;
}

/** Todas as ilustrações do acervo, filtráveis por categoria, com visão ampliada. */
export function Galeria({ imagens, categorias }: Props) {
  const [categoria, setCategoria] = useState<string | null>(null);
  const [soAberturas, setSoAberturas] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);

  const visiveis = useMemo(
    () =>
      imagens.filter(
        (imagem) =>
          (!categoria || imagem.doc?.categorySlug === categoria) && (!soAberturas || imagem.hero),
      ),
    [imagens, categoria, soAberturas],
  );

  // Só as categorias que têm imagem viram filtro.
  const comImagem = useMemo(() => {
    const slugs = new Set(imagens.map((imagem) => imagem.doc?.categorySlug));
    return categorias.filter((c) => slugs.has(c.slug));
  }, [imagens, categorias]);

  const andar = useCallback(
    (passo: number) => {
      setAberta((atual) =>
        atual === null ? null : (atual + passo + visiveis.length) % visiveis.length,
      );
    },
    [visiveis.length],
  );

  useEffect(() => {
    if (aberta === null) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setAberta(null);
      if (event.key === 'ArrowRight') andar(1);
      if (event.key === 'ArrowLeft') andar(-1);
    };
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener('keydown', onKey);
    };
  }, [aberta, andar]);

  const atual = aberta === null ? null : visiveis[aberta];

  return (
    <div className="galeria">
      <div className="filtros" role="group" aria-label="Filtrar ilustrações">
        <button type="button" className="filtro" aria-pressed={categoria === null} onClick={() => setCategoria(null)}>
          Tudo
        </button>
        {comImagem.map((c) => (
          <button
            key={c.slug}
            type="button"
            className="filtro"
            aria-pressed={categoria === c.slug}
            onClick={() => setCategoria(categoria === c.slug ? null : c.slug)}
          >
            {c.title}
          </button>
        ))}
        <button
          type="button"
          className="filtro filtro--solto"
          aria-pressed={soAberturas}
          onClick={() => setSoAberturas((v) => !v)}
        >
          Só as de abertura
        </button>
      </div>

      <p className="galeria__conta">
        {visiveis.length} ilustraç{visiveis.length === 1 ? 'ão' : 'ões'}
      </p>

      <ul className="galeria__grade">
        {visiveis.map((imagem, i) => (
          <li key={imagem.caminho}>
            <button
              type="button"
              className="galeria__item"
              onClick={() => setAberta(i)}
              aria-label={`Ampliar: ${imagem.legenda || imagem.caminho}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagem.src} alt={imagem.legenda} loading="lazy" decoding="async" />
              <span className="galeria__legenda">{imagem.doc?.title ?? imagem.legenda}</span>
            </button>
          </li>
        ))}
      </ul>

      {atual ? (
        <div
          className="luz"
          role="dialog"
          aria-modal="true"
          aria-label={atual.legenda || 'Ilustração'}
          onClick={(event) => {
            if (event.target === event.currentTarget) setAberta(null);
          }}
        >
          <button type="button" className="luz__fechar" onClick={() => setAberta(null)} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
          <button type="button" className="luz__passo luz__passo--antes" onClick={() => andar(-1)} aria-label="Anterior">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <figure className="luz__figura">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={atual.src} alt={atual.legenda} />
            <figcaption>
              <span>{atual.legenda}</span>
              {atual.doc ? (
                <Link href={atual.doc.href} onClick={() => setAberta(null)}>
                  {atual.doc.title} <ArrowRight size={13} aria-hidden="true" />
                </Link>
              ) : null}
            </figcaption>
          </figure>
          <button type="button" className="luz__passo luz__passo--depois" onClick={() => andar(1)} aria-label="Próxima">
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
