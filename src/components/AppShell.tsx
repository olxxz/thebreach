'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen, Castle, Clock, Github, History, Home, Hourglass, Images, Languages, Menu, PanelLeft,
  Feather, PanelRight, Pin, PinOff, Ruler, ScrollText, Search as SearchIcon, Share2,
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
import { useGravados } from '@/hooks/useGravados';
import { tituloDoGravado } from '@/lib/breach/recentes';
import { hrefForPath } from '@/lib/breach/slug';

export type { NavCategory, NavDoc };

interface Props {
  nav: NavCategory[];
  searchRecords: SearchRecord[];
  eras: Array<{ id: string; titulo: string }>;
  /** O cofre do Ateliê publicado no acervo, quando há um. */
  cofre: string | null;
  /** Instante em que o site foi construído: o que foi gravado depois é provisório. */
  geradoEm: string;
  /** Os documentos que o público vê. */
  publicos: string[];
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

export function AppShell({ nav, searchRecords, eras, cofre, geradoEm, publicos, repoUrl, children }: Props) {
  const pathname = usePathname();
  const {
    theme, toggleTheme, nav: navMode, setNav, drawer, setDrawer, tools, toggleTools, admin,
  } = useAppearance();

  // O que este navegador gravou e o site ainda não publicou: aparece na
  // navegação e na busca até a publicação alcançar.
  const gravados = useGravados(geradoEm, admin);
  const provisorios = useMemo(() => {
    const conhecidos = new Set(publicos);
    return gravados.map(({ path, gravado }) => {
      const rota = conhecidos.has(path) ? hrefForPath(path) : null;
      return {
        path,
        titulo: tituloDoGravado(gravado.conteudo, path),
        novo: Boolean(gravado.novo) || !conhecidos.has(path),
        href: rota ?? `/atelie?d=${encodeURIComponent(path)}`,
        conteudo: gravado.conteudo,
      };
    });
  }, [gravados, publicos]);
  const registrosDaBusca = useMemo(() => {
    if (provisorios.length === 0) return searchRecords;
    const trocados = new Set(provisorios.map((item) => item.href));
    const novos: SearchRecord[] = provisorios.map((item) => ({
      title: `${item.titulo} · provisório`,
      href: item.href,
      categoria: 'Provisório',
      subtipo: null,
      excerpt: toPlainTextLeve(item.conteudo).slice(0, 220),
      headings: [...item.conteudo.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1]).join(' '),
      body: toPlainTextLeve(item.conteudo),
      capa: null,
      eras: [],
    }));
    return [...novos, ...searchRecords.filter((record) => !trocados.has(record.href))];
  }, [provisorios, searchRecords]);
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
            {admin ? (
              <Link className="tool tool--atelie" href="/atelie" title="Ir ao Ateliê: propostas e lacunas">
                <Feather size={15} aria-hidden="true" />
                <span>Ateliê</span>
              </Link>
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
              aria-label={tools === 'open' ? 'Fechar as configurações' : 'Abrir as configurações'}
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
      <aside className="utilrail" ref={ferrRef} aria-label="Configurações do site">
        <div className="utilrail__bar">
          <p className="utilrail__label">Configurações</p>
          <button
            type="button"
            className="utilrail__chave"
            onClick={toggleTools}
            aria-expanded={tools === 'open'}
            aria-label={tools === 'open' ? 'Recolher as configurações' : 'Abrir as configurações'}
            title={tools === 'open' ? 'Recolher as configurações' : 'Abrir as configurações'}
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
          aria-label={admin ? 'No Ateliê — sair ou trocar a senha' : 'Entrar no Ateliê'}
          title="Ateliê (Ctrl+Alt+A)"
        >
          <Feather size={18} aria-hidden="true" />
          <span className="utilrail__nome">{admin ? 'No Ateliê' : 'Entrar no Ateliê'}</span>
        </button>
        {admin ? (
          <Link className="utilrail__tool" href="/atelie" title="Propostas, lacunas e documentos que o público não vê">
            <Stamp size={18} aria-hidden="true" />
            <span className="utilrail__nome">Abrir o Ateliê</span>
          </Link>
        ) : null}
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
              <PanelRight size={15} aria-hidden="true" /> Tema e configurações
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

          {provisorios.length > 0 ? (
            <div className="railnav__group railnav__group--provisorio">
              <p className="railnav__title">Provisórios</p>
              <ul className="railnav__list">
                {provisorios.map((item) => (
                  <li key={item.path}>
                    <Link className="railnav__item" href={item.href} title={`${item.path} — gravado, o site ainda não publicou`}>
                      <Clock size={16} aria-hidden="true" />
                      <span>{item.titulo}</span>
                      <span className="railnav__count">{item.novo ? 'novo' : 'editado'}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

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
            aria-label={drawer ? 'Fechar a navegação' : 'Fechar as configurações'}
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

      <SearchDialog records={registrosDaBusca} eras={eras} open={search} onClose={() => setSearch(false)} />
      <TokenDialog open={tokenDialog} onClose={() => setTokenDialog(false)} cofre={cofre} />
    </div>
  );
}

/** Texto corrido de um markdown, sem o pipeline inteiro: basta para a busca. */
function toPlainTextLeve(markdown: string): string {
  return markdown
    .replace(/^\*\*[^*]+:\*\*.*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
