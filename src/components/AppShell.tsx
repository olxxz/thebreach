'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen, Castle, Github, History, Home, Hourglass, Images, Languages, Menu, PanelLeft,
  PanelRight, Pin, PinOff, Ruler, ScrollText, Search as SearchIcon, Share2, Shield, ShieldCheck,
  Stamp, Sun, Users, X,
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
  eras: Array<{ id: string; titulo: string }>;
  /** O cofre do modo administrador publicado no acervo, quando há um. */
  cofre: string | null;
  repoUrl: string;
  children: React.ReactNode;
}

/** Explorar: o mundo por reino, por era e por personagem. */
const EXPLORAR = [
  { href: ROTA_LINHA_DO_TEMPO, label: 'Linha do tempo', Icone: Hourglass },
  { href: '/reinos', label: 'Reinos', Icone: Castle },
  { href: '/personagens', label: 'Personagens', Icone: Users },
  { href: '/galeria', label: 'Galeria', Icone: Images },
  { href: '/relacoes', label: 'Relações', Icone: Share2 },
  { href: '/thalae', label: 'Aprender Thalae', Icone: Languages },
];

/** Meta: como o acervo é mantido. */
const META = [
  { href: '/compendio', label: 'Índice canônico', Icone: BookOpen },
  { href: '/alteracoes', label: 'Alterações', Icone: History },
  { href: '/convencoes', label: 'Convenções', Icone: Ruler },
];

const MAIN_LINKS = [...EXPLORAR, ...META];

export function AppShell({ nav, searchRecords, eras, cofre, repoUrl, children }: Props) {
  const pathname = usePathname();
  const {
    theme, toggleTheme, nav: navMode, setNav, drawer, setDrawer, tools, toggleTools, admin,
    soCanone, toggleCanone,
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

  // A aba da barra inferior em que se está. O que não é início, reinos nem
  // personagens mora no acervo.
  const aqui = pathname.replace(/\/+$/, '') || '/';
  const abaAtiva = search
    ? 2
    : drawer
      ? 4
      : aqui === '/'
        ? 0
        : aqui.startsWith('/reinos')
          ? 1
          : aqui.startsWith('/personagens')
            ? 3
            : 4;

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
            {soCanone ? (
              <button type="button" className="tool tool--canone" onClick={toggleCanone} title="Mostrar tudo de novo">
                <Stamp size={15} aria-hidden="true" />
                <span>Só o cânone</span>
                <X size={13} aria-hidden="true" />
              </button>
            ) : null}
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
          data-ativo={soCanone}
          aria-pressed={soCanone}
          onClick={toggleCanone}
          title={soCanone ? 'Mostrar propostas e lacunas' : 'Ler só o que é cânone'}
        >
          <Stamp size={18} aria-hidden="true" />
          <span className="utilrail__nome">{soCanone ? 'Só o cânone: ligado' : 'Só o cânone'}</span>
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
            <button type="button" className="railnav__ferramentas" onClick={abrirFerramentas}>
              <PanelRight size={15} aria-hidden="true" /> Tema e ferramentas
            </button>
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
            <p className="railnav__title">Explorar</p>
            <ul className="railnav__list">
              {EXPLORAR.map(({ href, label, Icone }) => (
                <li key={href}>
                  <span className="railnav__linha" data-estado={estadoDe(pathname, href)}>
                    <Link
                      className="railnav__item railnav__item--icone"
                      href={href}
                      aria-current={estadoDe(pathname, href) === 'atual' ? 'page' : undefined}
                    >
                      <Icone size={16} aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
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
              {META.map(({ href, label, Icone }) => (
                <li key={href}>
                  <span className="railnav__linha" data-estado={estadoDe(pathname, href)}>
                    <Link
                      className="railnav__item railnav__item--icone"
                      href={href}
                      aria-current={estadoDe(pathname, href) === 'atual' ? 'page' : undefined}
                    >
                      <Icone size={16} aria-hidden="true" />
                      <span>{label}</span>
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

      {/* No celular, o que mais se usa fica ao alcance do polegar. */}
      <nav className="barra" aria-label="Atalhos" style={{ ['--barra-i' as string]: abaAtiva }}>
        {/* A marca da aba em que se está: desliza de uma para a outra. */}
        <span className="barra__marca" aria-hidden="true" />
        <Link className="barra__item" href="/" data-ativa={abaAtiva === 0}>
          <Home size={22} aria-hidden="true" />
          <span>Início</span>
        </Link>
        <Link className="barra__item" href="/reinos" data-ativa={abaAtiva === 1}>
          <Castle size={22} aria-hidden="true" />
          <span>Reinos</span>
        </Link>
        <button type="button" className="barra__item" data-ativa={abaAtiva === 2} onClick={abrirBusca}>
          <SearchIcon size={22} aria-hidden="true" />
          <span>Buscar</span>
        </button>
        <Link className="barra__item" href="/personagens" data-ativa={abaAtiva === 3}>
          <Users size={22} aria-hidden="true" />
          <span>Personagens</span>
        </Link>
        <button
          type="button"
          className="barra__item"
          data-ativa={abaAtiva === 4}
          onClick={() => (drawer ? setDrawer(false) : abrirNavegacao())}
          aria-expanded={drawer}
        >
          <Menu size={22} aria-hidden="true" />
          <span>Acervo</span>
        </button>
      </nav>

      <SearchDialog records={searchRecords} eras={eras} open={search} onClose={() => setSearch(false)} />
      <TokenDialog open={tokenDialog} onClose={() => setTokenDialog(false)} cofre={cofre} />
    </div>
  );
}
