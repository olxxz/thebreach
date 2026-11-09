'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Github, PanelLeft, PanelRight, Pin, PinOff, ScrollText, Search as SearchIcon, Shield,
  ShieldCheck, Sun, X,
} from 'lucide-react';
import type { SearchRecord } from '@/lib/breach/types';
import { LARGO, useMedia } from '@/lib/media';
import { useAppearance } from './AppearanceProvider';
import { SearchDialog } from './SearchDialog';
import { Sigil } from './Sigil';
import { TokenDialog } from './TokenDialog';
import { estadoDe, type NavCategory, type NavDoc } from './nav/arvore';
import { Chave, NavDocs } from './nav/NavDocs';
import { useArvoreAberta } from '@/hooks/useArvoreAberta';
import { useArrastoGavetas } from '@/hooks/useArrastoGavetas';
import { useAtalhos } from '@/hooks/useAtalhos';
import { NOME_REPOSITORIO } from '@/lib/breach/repositorio';
import { ROTA_LINHA_DO_TEMPO } from '@/lib/breach/rotas';

export type { NavCategory, NavDoc };

interface Props {
  nav: NavCategory[];
  searchRecords: SearchRecord[];
  repoUrl: string;
  children: React.ReactNode;
}

const MAIN_LINKS = [
  { href: ROTA_LINHA_DO_TEMPO, label: 'Linha do tempo' },
  { href: '/compendio', label: 'Índice canônico' },
  { href: '/alteracoes', label: 'Alterações' },
  { href: '/convencoes', label: 'Convenções' },
  { href: '/thalae', label: 'Aprender Thalae' },
];

export function AppShell({ nav, searchRecords, repoUrl, children }: Props) {
  const pathname = usePathname();
  const {
    theme, toggleTheme, nav: navMode, setNav, drawer, setDrawer, tools, toggleTools, admin,
  } = useAppearance();
  const [search, setSearch] = useState(false);
  const [tokenDialog, setTokenDialog] = useState(false);
  const wide = useMedia('(min-width: 72rem)');
  // Abaixo disso a tela é de dedo, e as laterais respondem ao arrasto.
  const estreito = !useMedia(LARGO);

  const { abertos, alternar } = useArvoreAberta(pathname);

  /** Barra lateral ocupando espaço próprio, sem cobrir o conteúdo. */
  const railFixed = wide && navMode === 'pinned';

  useEffect(() => {
    setDrawer(false);
  }, [pathname, setDrawer]);

  // Duas gavetas abertas ao mesmo tempo não fazem sentido: abrir uma fecha a
  // outra.
  const abrirNavegacao = useCallback(() => {
    if (tools === 'open') toggleTools();
    setDrawer(true);
  }, [tools, toggleTools, setDrawer]);

  const abrirFerramentas = useCallback(() => {
    setDrawer(false);
    if (tools !== 'open') toggleTools();
  }, [tools, toggleTools, setDrawer]);

  const { navRef, ferrRef, veuRef, arrastando } = useArrastoGavetas({
    ativo: estreito, drawer, tools, toggleTools, setDrawer,
  });

  const abrirBusca = useCallback(() => setSearch(true), []);
  const abrirAcesso = useCallback(() => setTokenDialog(true), []);
  useAtalhos(abrirBusca, abrirAcesso);
  // Fixada, o botão do cabeçalho recolhe; solta, abre e fecha a gaveta.
  const toggleNav = (): void => {
    if (railFixed) {
      setNav('floating');
      setDrawer(false);
      return;
    }
    if (drawer) setDrawer(false);
    else abrirNavegacao();
  };

  const togglePin = (): void => {
    setNav(navMode === 'pinned' ? 'floating' : 'pinned');
    setDrawer(false);
  };

  return (
    <div className="app">
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>

      <header className="masthead">
        <div className="masthead__inner">
          <button
            type="button"
            className="tool tool--nav"
            aria-label={railFixed ? 'Recolher a navegação' : drawer ? 'Fechar a navegação' : 'Abrir a navegação'}
            aria-expanded={railFixed || drawer}
            onClick={toggleNav}
          >
            <PanelLeft size={19} aria-hidden="true" />
          </button>

          <Link className="brand" href="/">
            <span className="brand__mark">
              <Sigil />
            </span>
            <span className="brand__text">
              <span className="brand__name">Compêndio Breach</span>
              <span className="brand__tag">acervo de um universo em construção</span>
            </span>
          </Link>

          <div className="tools">
            <button
              type="button"
              className="tool tool--wide"
              onClick={() => setSearch(true)}
              aria-label="Buscar no acervo"
            >
              <SearchIcon size={17} aria-hidden="true" />
              <span>Buscar</span>
              <kbd>/</kbd>
            </button>
            <button
              type="button"
              className="tool tool--tools"
              onClick={() => (tools === 'open' ? toggleTools() : abrirFerramentas())}
              aria-label={tools === 'open' ? 'Fechar as ferramentas' : 'Abrir as ferramentas'}
              aria-expanded={tools === 'open'}
            >
              <PanelRight size={19} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* A segunda lateral. A da esquerda é o acervo; esta é o aparelho — tema
          e repositório. Os três links de meta saíram daqui de cima porque já
          estão na navegação, e repetidos só faziam ruído.

          Como a da esquerda, abre e fecha: recolhida é uma faixa de ícones,
          aberta mostra os rótulos. */}
      <aside className="utilrail" ref={ferrRef} aria-label="Ferramentas do site">
        <div className="utilrail__bar">
          <p className="utilrail__label">Ferramentas</p>
          <button
            type="button"
            className="utilrail__chave"
            onClick={toggleTools}
            aria-expanded={tools === 'open'}
            aria-label={tools === 'open' ? 'Recolher as ferramentas' : 'Abrir as ferramentas'}
            title={tools === 'open' ? 'Recolher as ferramentas' : 'Abrir as ferramentas'}
          >
            <PanelRight size={17} aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          className="utilrail__tool"
          onClick={toggleTheme}
          aria-label={theme === 'sepia' ? 'Usar tema claro' : 'Usar tema sépia'}
          title={theme === 'sepia' ? 'Usar tema claro' : 'Usar tema sépia'}
        >
          {theme === 'sepia' ? <Sun size={18} aria-hidden="true" /> : <ScrollText size={18} aria-hidden="true" />}
          <span className="utilrail__nome">{theme === 'sepia' ? 'Tema claro' : 'Tema sépia'}</span>
        </button>
        <button
          type="button"
          className="utilrail__tool"
          data-ativo={admin}
          onClick={() => setTokenDialog(true)}
          aria-label="Modo administrador"
          title="Modo administrador (Ctrl+Alt+A)"
        >
          {admin ? <ShieldCheck size={18} aria-hidden="true" /> : <Shield size={18} aria-hidden="true" />}
          <span className="utilrail__nome">{admin ? 'Administrador' : 'Modo administrador'}</span>
        </button>
        <a
          className="utilrail__tool"
          href={repoUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Ver o acervo no GitHub"
          title="Ver o acervo no GitHub"
        >
          <Github size={18} aria-hidden="true" />
          <span className="utilrail__nome">No GitHub</span>
        </a>
      </aside>

      <div className="frame">
        <aside className="railnav" ref={navRef} data-open={drawer} aria-label="Categorias do acervo">
          <div className="railnav__bar">
            <span className="railnav__label">Navegação</span>
            <button
              type="button"
              className="railnav__pin"
              onClick={togglePin}
              aria-pressed={navMode === 'pinned'}
              title={navMode === 'pinned' ? 'Soltar a barra lateral' : 'Fixar a barra lateral aberta'}
            >
              {navMode === 'pinned' ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
              <span className="sr-only">
                {navMode === 'pinned' ? 'Soltar a barra lateral' : 'Fixar a barra lateral aberta'}
              </span>
            </button>
            <button
              type="button"
              className="railnav__close"
              onClick={() => setDrawer(false)}
              aria-label="Fechar a navegação"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="railnav__group">
            <p className="railnav__title">Categorias</p>
            <ul className="railnav__list">
              {nav.map((category) => {
                const href = `/c/${category.slug}`;
                const temDocs = category.docs.length > 0;
                const aberto = abertos.has(href);
                const estado = estadoDe(pathname, href);
                return (
                  <li key={category.slug}>
                    <span className="railnav__linha" data-estado={estado}>
                      {temDocs ? (
                        <Chave
                          aberto={aberto}
                          rotulo={category.title}
                          alternar={() => alternar(href)}
                        />
                      ) : (
                        <span className="railnav__chave railnav__chave--vazia" aria-hidden="true" />
                      )}
                      <Link
                        className="railnav__item"
                        href={href}
                        aria-current={estado === 'atual' ? 'page' : undefined}
                      >
                        <span className="railnav__num">{category.number}</span>
                        <span>{category.title}</span>
                        <span className="railnav__count">{category.count || '—'}</span>
                      </Link>
                    </span>
                    {temDocs && aberto ? (
                      <NavDocs
                        docs={category.docs}
                        base={href}
                        pathname={pathname}
                        abertos={abertos}
                        alternar={alternar}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="railnav__group">
            <p className="railnav__title">Meta</p>
            <ul className="railnav__list">
              {MAIN_LINKS.map((link) => (
                <li key={link.href}>
                  <span className="railnav__linha" data-estado={estadoDe(pathname, link.href)}>
                    <span className="railnav__chave railnav__chave--vazia" aria-hidden="true" />
                    <Link
                      className="railnav__item"
                      href={link.href}
                      aria-current={estadoDe(pathname, link.href) === 'atual' ? 'page' : undefined}
                    >
                      <span>{link.label}</span>
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Um véu só, para os dois lados: durante o arrasto ele precisa existir
            antes de a gaveta terminar de entrar, e dois véus empilhados
            escureceriam o dobro. */}
        {drawer || tools === 'open' || arrastando ? (
          <button
            type="button"
            ref={veuRef}
            className="scrim"
            data-visivel={drawer || tools === 'open'}
            aria-label={drawer ? 'Fechar a navegação' : 'Fechar as ferramentas'}
            onClick={() => {
              setDrawer(false);
              if (tools === 'open') toggleTools();
            }}
          />
        ) : null}

        <main className="main" id="conteudo">
          {children}
        </main>
      </div>

      <footer className="colophon">
        <div className="colophon__inner">
          <div>
            <p className="colophon__title">Compêndio Breach</p>
            <p>
              Representação visual do acervo. Todo o conteúdo vem do repositório{' '}
              <a href={repoUrl} target="_blank" rel="noreferrer noopener">
                {NOME_REPOSITORIO}
              </a>
              , lido como banco de dados durante a publicação.
            </p>
          </div>
          <div>
            <p className="colophon__title">Navegar</p>
            <ul className="colophon__list">
              {MAIN_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="colophon__title">Categorias</p>
            <ul className="colophon__list">
              {nav.slice(0, 5).map((category) => (
                <li key={category.slug}>
                  <Link href={`/c/${category.slug}`}>{category.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>

      <SearchDialog records={searchRecords} open={search} onClose={() => setSearch(false)} />
      <TokenDialog open={tokenDialog} onClose={() => setTokenDialog(false)} />
    </div>
  );
}
