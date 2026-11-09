'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Fuse from 'fuse.js';
import { CornerDownLeft, Search as SearchIcon, X } from 'lucide-react';
import type { SearchRecord } from '@/lib/breach/types';

interface Props {
  records: SearchRecord[];
  eras: Array<{ id: string; titulo: string }>;
  open: boolean;
  onClose: () => void;
}

/**
 * Busca client-side sobre o índice gerado no build. O acervo é pequeno; o
 * índice inteiro viaja com a página e a busca é instantânea, sem servidor.
 */
export function SearchDialog({ records, eras, open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [era, setEra] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  // O mouse também move o cursor; rolar por causa dele faria a lista fugir
  // debaixo do ponteiro. Só a navegação por teclado rola.
  const viaTeclado = useRef(false);

  const fuse = useMemo(
    () =>
      new Fuse(records, {
        includeScore: true,
        threshold: 0.38,
        ignoreLocation: true,
        minMatchCharLength: 2,
        keys: [
          { name: 'title', weight: 0.45 },
          { name: 'headings', weight: 0.2 },
          { name: 'excerpt', weight: 0.2 },
          { name: 'categoria', weight: 0.1 },
          { name: 'body', weight: 0.05 },
        ],
      }),
    [records],
  );

  const results = useMemo(() => {
    const term = query.trim();
    const daEra = (record: SearchRecord): boolean => !era || record.eras.includes(era);
    if (!term) return records.filter(daEra).slice(0, era ? 40 : 8);
    return fuse
      .search(term, { limit: era ? 60 : 12 })
      .map((hit) => hit.item)
      .filter(daEra)
      .slice(0, 12);
  }, [fuse, query, records, era]);

  useEffect(() => {
    setCursor(0);
    viaTeclado.current = false;
    if (listaRef.current) listaRef.current.scrollTop = 0;
  }, [query, era]);

  // Andar com as setas tem de trazer o resultado destacado para dentro da
  // lista; sem isto o cursor desce sozinho e some por baixo da borda.
  useEffect(() => {
    if (!viaTeclado.current) return;
    viaTeclado.current = false;
    listaRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({
      block: 'nearest',
    });
  }, [cursor]);

  useEffect(() => {
    if (open) {
      setQuery('');
      // O foco só existe depois que o diálogo entra no DOM.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Escape') {
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      viaTeclado.current = true;
      setCursor((value) => Math.min(value + 1, results.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      viaTeclado.current = true;
      setCursor((value) => Math.max(value - 1, 0));
      return;
    }
    if (event.key === 'Enter' && results[cursor]) {
      event.preventDefault();
      go(results[cursor].href);
    }
  };

  if (!open) return null;

  return (
    <div
      className="searchdialog"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="searchdialog__panel" role="dialog" aria-modal="true" aria-label="Buscar no acervo">
        <div className="searchdialog__field">
          <SearchIcon size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder="Buscar entidade, categoria, seção…"
            aria-label="Termo de busca"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          {query ? (
            <button
              type="button"
              className="searchdialog__limpar"
              aria-label="Limpar a busca"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {eras.length > 0 ? (
          <div className="filtros searchdialog__eras" role="group" aria-label="Filtrar por era">
            <button type="button" className="filtro" aria-pressed={era === null} onClick={() => setEra(null)}>
              Todas as eras
            </button>
            {eras.map((e) => (
              <button
                key={e.id}
                type="button"
                className="filtro"
                aria-pressed={era === e.id}
                onClick={() => setEra(era === e.id ? null : e.id)}
              >
                {e.titulo}
              </button>
            ))}
          </div>
        ) : null}

        {results.length === 0 ? (
          <p className="searchdialog__foot">
            {query ? `Nada no acervo corresponde a “${query}”` : 'Nenhum documento'}
            {era ? ' nesta era' : ''}.
          </p>
        ) : (
          <ul className="searchdialog__results" ref={listaRef}>
            {results.map((record, index) => (
              <li key={record.href}>
                <a
                  className="searchresult"
                  href={record.href}
                  data-active={index === cursor}
                  onMouseEnter={() => setCursor(index)}
                  onClick={(event) => {
                    event.preventDefault();
                    go(record.href);
                  }}
                >
                  {record.capa ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="searchresult__capa" src={record.capa} alt="" loading="lazy" />
                  ) : (
                    <span className="searchresult__capa" aria-hidden="true" />
                  )}
                  <span className="searchresult__corpo">
                    <span className="searchresult__top">
                      <span className="searchresult__title">{record.title}</span>
                      <span className="searchresult__cat">
                        {record.categoria}
                        {record.subtipo ? ` · ${record.subtipo}` : ''}
                      </span>
                    </span>
                    {record.excerpt ? <span className="searchresult__text">{record.excerpt}</span> : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="searchdialog__foot">
          <span>
            <CornerDownLeft size={12} aria-hidden="true" /> abrir
          </span>
          <span>↑ ↓ navegar</span>
          <span>esc fechar</span>
        </div>
      </div>
    </div>
  );
}
