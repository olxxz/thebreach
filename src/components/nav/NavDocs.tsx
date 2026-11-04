'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { estadoDe, type NavDoc } from './arvore';

/**
 * A chave que abre e fecha um galho.
 *
 * É botão separado do link de propósito: o nome leva ao documento, a chave só
 * mostra o que há dentro. Sem isso, ver o conteúdo de uma pasta obrigaria a
 * navegar até ela.
 */
export function Chave({
  aberto,
  rotulo,
  alternar,
}: {
  aberto: boolean;
  rotulo: string;
  alternar: () => void;
}) {
  return (
    <button
      type="button"
      className="railnav__chave"
      aria-expanded={aberto}
      aria-label={`${aberto ? 'Recolher' : 'Abrir'} ${rotulo}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        alternar();
      }}
    >
      <ChevronRight size={13} aria-hidden="true" />
    </button>
  );
}

/** Entidades da categoria, aninhadas como estão no acervo. */
export function NavDocs({
  docs,
  base,
  pathname,
  abertos,
  alternar,
}: {
  docs: NavDoc[];
  base: string;
  pathname: string;
  abertos: Set<string>;
  alternar: (chave: string) => void;
}) {
  return (
    <ul className="railnav__sub">
      {docs.map((doc) => {
        const docHref = `${base}/${doc.slug}`;
        const temFilhos = doc.children.length > 0;
        const aberto = abertos.has(docHref);
        const estado = estadoDe(pathname, docHref);
        return (
          <li key={doc.slug}>
            <span className="railnav__linha" data-estado={estado}>
              {temFilhos ? (
                <Chave aberto={aberto} rotulo={doc.title} alternar={() => alternar(docHref)} />
              ) : (
                <span className="railnav__chave railnav__chave--vazia" aria-hidden="true" />
              )}
              <Link
                className="railnav__sublink"
                href={docHref}
                aria-current={estado === 'atual' ? 'page' : undefined}
              >
                {doc.title}
              </Link>
            </span>
            {temFilhos && aberto ? (
              <NavDocs
                docs={doc.children}
                base={base}
                pathname={pathname}
                abertos={abertos}
                alternar={alternar}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
