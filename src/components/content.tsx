import Link from 'next/link';
import { FileText, GitBranch, Hourglass, Link2, ScrollText, Share2 } from 'lucide-react';
import type { EraRef } from '@/lib/breach/linhaDoTempo';
import type {
  BreachCategory,
  BreachDoc,
  DocSection,
  NoResumo,
  Resumo,
  MarkerTally,
} from '@/lib/breach/types';
import { MARKERS, MARKER_ORDER, tallyTotal } from '@/lib/breach/markers';
import { accentFor } from '@/lib/layouts';
import { slugify } from '@/lib/breach/slug';
import { Toc, type TocItem } from './Toc';

/* --- Blocos de página ---------------------------------------------------- */

/** Tamanho padrão do hero (CONVENCOES.md §8): 1536 × 1024, proporção 3:2. */
export const HERO_LARGURA = 1536;
export const HERO_ALTURA = 1024;

/**
 * Ilustração de abertura, num quadro de proporção fixa. Imagens fora do padrão
 * aparecem inteiras dentro do quadro, sem corte, e a página não pula enquanto
 * a imagem carrega.
 */
export function Hero({ src, alt, caption }: { src: string; alt: string; caption?: string | null }) {
  return (
    <figure className="hero">
      {/* Export estático: imagem simples, sem o otimizador do Next. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="hero__art"
        src={src}
        alt={alt}
        width={HERO_LARGURA}
        height={HERO_ALTURA}
        decoding="async"
        fetchPriority="high"
      />
      {caption ? <figcaption className="hero__legenda">{caption}</figcaption> : null}
    </figure>
  );
}

export function PageHead({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="pagehead">
      {eyebrow ? <p className="pagehead__eyebrow">{eyebrow}</p> : null}
      <h1 className="pagehead__title">{title}</h1>
      {lede ? <p className="pagehead__lede">{lede}</p> : null}
      {children}
    </header>
  );
}

export function Crumbs({ trail }: { trail: Array<{ href?: string; label: string }> }) {
  return (
    <nav className="crumbs" aria-label="Trilha">
      {trail.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`}>
          {index > 0 ? <span aria-hidden="true">/ </span> : null}
          {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Chip({
  label,
  value,
  status,
  icon,
}: {
  label?: string;
  value: string;
  status?: boolean;
  icon?: React.ReactNode;
}) {
  const className = status ? `chip chip--status chip--${slugify(value)}` : 'chip';
  return (
    <span className={className}>
      {icon}
      {label ? <span className="chip__key">{label}</span> : null}
      <span>{value}</span>
    </span>
  );
}

/* --- Marcadores ---------------------------------------------------------- */

export function MarkerMeter({ tally }: { tally: MarkerTally }) {
  const total = tallyTotal(tally);
  if (total === 0) return null;
  return (
    <span
      className="meter"
      role="img"
      aria-label={MARKER_ORDER.filter((id) => tally[id])
        .map((id) => `${tally[id]} ${MARKERS[id].label}`)
        .join(', ')}
    >
      {MARKER_ORDER.filter((id) => tally[id]).map((id) => (
        <span
          key={id}
          className={`meter__part meter__part--${id.toLowerCase()}`}
          style={{ width: `${((tally[id] as number) / total) * 100}%` }}
        />
      ))}
    </span>
  );
}

export function MarkerLegend() {
  return (
    <div className="legend">
      {MARKER_ORDER.map((id) => (
        <p className="legend__row" key={id}>
          <span className={`marker marker--${id.toLowerCase()}`}>
            <span className="marker__label">{MARKERS[id].label}</span>
          </span>
          <span>{MARKERS[id].meaning}</span>
        </p>
      ))}
    </div>
  );
}

/* --- Cartões ------------------------------------------------------------- */

export function CategoryCard({ category }: { category: BreachCategory }) {
  const empty = category.docs.length === 0;
  return (
    <Link
      className={`card${empty ? ' card--empty' : ''}`}
      href={`/c/${category.slug}`}
      style={{ ['--card-accent' as string]: accentFor(category.slug) }}
    >
      <span className="card__num">{category.number}</span>
      <h3 className="card__title">{category.title}</h3>
      <p className="card__text">{category.description}</p>
      <span className="card__foot">
        <FileText size={14} aria-hidden="true" />
        {empty ? 'sem documentos' : `${category.docs.length} documento${category.docs.length > 1 ? 's' : ''}`}
        {category.gaps.length > 0 ? <span>· {category.gaps.length} lacunas</span> : null}
      </span>
    </Link>
  );
}

export function DocCard({ doc }: { doc: Resumo }) {
  return (
    <Link
      className={`card${doc.capa ? ' card--figura' : ''}`}
      href={doc.href}
      style={{ ['--card-accent' as string]: accentFor(doc.categorySlug) }}
    >
      {doc.capa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="card__capa" src={doc.capa} alt="" loading="lazy" decoding="async" />
      ) : null}
      <span className="card__num">{doc.subtipo ?? (doc.kind === 'narrativa' ? 'narrativa' : 'documento')}</span>
      <h3 className="card__title">{doc.title}</h3>
      <p className="card__text">{doc.excerpt}</p>
      <MarkerMeter tally={doc.markers} />
      <span className="card__foot">
        {doc.status ? <span>{doc.status}</span> : null}
        {doc.gapCount > 0 ? <span>· {doc.gapCount} lacunas</span> : null}
        {doc.updatedAt ? <span style={{ marginLeft: 'auto' }}>{doc.updatedAt}</span> : null}
      </span>
    </Link>
  );
}

/**
 * Entidades de uma categoria, aninhadas como estão no acervo: as espécies
 * aparecem debaixo da classe que as contém (CONVENCOES.md §6).
 *
 * Entidades sem filhas seguem em grade, lado a lado. Uma entidade com filhas
 * abre bloco próprio, para o parentesco ficar visível.
 */
export function DocTree({ nodes }: { nodes: NoResumo[] }) {
  type Bloco =
    | { tipo: 'folhas'; nodes: NoResumo[] }
    | { tipo: 'ramo'; node: NoResumo };

  const blocos: Bloco[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      blocos.push({ tipo: 'ramo', node });
      continue;
    }
    const ultimo = blocos[blocos.length - 1];
    if (ultimo?.tipo === 'folhas') ultimo.nodes.push(node);
    else blocos.push({ tipo: 'folhas', nodes: [node] });
  }

  return (
    <div className="tree">
      {blocos.map((bloco) =>
        bloco.tipo === 'folhas' ? (
          <div className="grid grid--wide" key={bloco.nodes[0].doc.path}>
            {bloco.nodes.map((node) => (
              <DocCard key={node.doc.path} doc={node.doc} />
            ))}
          </div>
        ) : (
          <div className="tree__ramo" key={bloco.node.doc.path}>
            <DocCard doc={bloco.node.doc} />
            <div className="tree__galhos">
              <DocTree nodes={bloco.node.children} />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

/* --- Documento ----------------------------------------------------------- */

function Section({ section }: { section: DocSection }) {
  return (
    <section className={`section${section.isGap ? ' section--gap' : ''}`} id={section.id}>
      <div className="section__head">
        {section.number ? <span className="section__num">{section.number}</span> : null}
        <h2 className="section__title">{section.title}</h2>
      </div>
      {section.isGap ? (
        <p className="gapnote">
          <ScrollText size={16} aria-hidden="true" />
          Ainda não definido pelo Criador.
        </p>
      ) : (
        <div className="prose" dangerouslySetInnerHTML={{ __html: section.html }} />
      )}
      {section.children.map((child) => (
        <div className="section__sub" key={child.id} id={child.id}>
          <h3 className="section__subtitle">
            {child.number ? <span className="section__num">{child.number}</span> : null} {child.title}
          </h3>
          {child.isGap ? (
            <p className="gapnote">
              <ScrollText size={16} aria-hidden="true" />
              Ainda não definido pelo Criador.
            </p>
          ) : (
            <div className="prose" dangerouslySetInnerHTML={{ __html: child.html }} />
          )}
        </div>
      ))}
    </section>
  );
}

/** As seções de um documento, sem a ficha nem o sumário. */
export function DocSections({ sections }: { sections: DocSection[] }) {
  return (
    <>
      {sections.map((section) => (
        <Section key={section.id} section={section} />
      ))}
    </>
  );
}

export function DocArticle({
  doc,
  backlinks = [],
  semIntro = false,
  eras = [],
  chegam = [],
}: {
  doc: BreachDoc;
  backlinks?: BreachDoc[];
  /** Relações com nome que outros documentos têm com este. */
  chegam?: Array<{ verbo: string; doc: BreachDoc }>;
  /** Eras da linha do tempo em que o documento se passa. */
  eras?: EraRef[];
  /** A página já mostra a abertura do documento como lede do cabeçalho. */
  semIntro?: boolean;
}) {
  const tocItems: TocItem[] = doc.sections.flatMap((section) => [
    { id: section.id, label: section.number ? `${section.number}. ${section.title}` : section.title, level: 2 as const },
    ...section.children.map((child) => ({ id: child.id, label: child.title, level: 3 as const })),
  ]);

  const related = doc.header.documentosRelacionados.filter((ref) => ref.href);
  const derived = doc.header.documentosDerivados.filter((ref) => ref.href);

  return (
    <>
      {/* Metadados fora da coluna de leitura: assim o sumário pode ficar ao
          lado do texto em telas largas e logo acima dele nas estreitas, sem
          nunca se meter entre o título e a ficha do documento. */}
      <div className="doc__head">
        <div className="doc__meta">
          {eras.map((era) => (
            <Link className="chip chip--era" key={era.id} href={era.href}>
              <Hourglass size={12} aria-hidden="true" />
              <span className="chip__key">Era</span>
              <span>{era.titulo}</span>
            </Link>
          ))}
          {doc.header.status ? <Chip label="Status" value={doc.header.status} status /> : null}
          {doc.header.fontesInternas.length > 0 ? (
            <Chip label="Fontes internas" value={doc.header.fontesInternas.join(', ')} />
          ) : null}
          {doc.updatedAt ? <Chip label="Atualizado" value={doc.updatedAt} /> : null}
        </div>

        <div className="doc__gauge">
          <MarkerMeter tally={doc.markers} />
        </div>
      </div>

      <div className="doclayout">
        <article className="doc">
          {doc.introHtml && !semIntro ? (
          <div className="doc__intro prose" dangerouslySetInnerHTML={{ __html: doc.introHtml }} />
        ) : null}

        {doc.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}

        {(related.length > 0 || derived.length > 0 || backlinks.length > 0 || chegam.length > 0) && (
          <div className="panel" style={{ marginTop: 'var(--space-7)' }}>
            <p className="panel__title">
              Ligações
              <Link className="panel__acao" href={`/relacoes?foco=${encodeURIComponent(doc.path)}`}>
                <Share2 size={12} aria-hidden="true" /> ver no desenho
              </Link>
            </p>
            {doc.header.relacoes.length > 0 || chegam.length > 0 ? (
              <ul className="relacoes">
                {doc.header.relacoes.map((relacao) => (
                  <li key={`${relacao.verbo}-${relacao.path}`}>
                    <span className="relacoes__verbo">{relacao.verbo}</span>
                    <Link className="chip" href={relacao.href}>
                      {relacao.label}
                    </Link>
                  </li>
                ))}
                {chegam.map(({ verbo, doc: outro }) => (
                  <li key={`${outro.path}-${verbo}`}>
                    <Link className="chip" href={`/c/${outro.categorySlug}/${outro.slug}`}>
                      {outro.title}
                    </Link>
                    <span className="relacoes__verbo">{verbo} {doc.title}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {related.length > 0 ? (
              <p className="card__text" style={{ marginBottom: 'var(--space-3)' }}>
                <strong>Relacionados: </strong>
                <span className="reflist">
                  {related.map((ref) => (
                    <Link className="chip" key={ref.path} href={ref.href}>
                      <Link2 size={13} aria-hidden="true" />
                      {ref.label}
                    </Link>
                  ))}
                </span>
              </p>
            ) : null}
            {derived.length > 0 ? (
              <p className="card__text" style={{ marginBottom: 'var(--space-3)' }}>
                <strong>Documentos derivados: </strong>
                <span className="reflist">
                  {derived.map((ref) => (
                    <Link className="chip" key={ref.path} href={ref.href}>
                      <Link2 size={13} aria-hidden="true" />
                      {ref.label}
                    </Link>
                  ))}
                </span>
              </p>
            ) : null}
            {backlinks.length > 0 ? (
              <p className="card__text">
                <strong>Citado por: </strong>
                <span className="reflist">
                  {backlinks.map((ref) => (
                    <Link className="chip" key={ref.path} href={`/c/${ref.categorySlug}/${ref.slug}`}>
                      <Link2 size={13} aria-hidden="true" />
                      {ref.title}
                    </Link>
                  ))}
                </span>
              </p>
            ) : null}
          </div>
        )}

          <p className="card__foot" style={{ marginTop: 'var(--space-6)' }}>
            <GitBranch size={14} aria-hidden="true" />
            <a href={doc.githubUrl} target="_blank" rel="noreferrer noopener">
              Ver <code>{doc.path}</code> no repositório
            </a>
          </p>
        </article>

        <Toc items={tocItems} />
      </div>
    </>
  );
}
