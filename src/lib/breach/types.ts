import type { Era, EraRef } from './linhaDoTempo';
import type { Cartao, Grafo, Ilustracao, Personagem, Reino } from './mundo';
import type { NomeDoAcervo, RaizDoAcervo } from '@/lib/thalae/raizes';

/**
 * Modelo de dados do Compêndio Breach.
 *
 * O acervo (github.com/olxxz/breach) é markdown puro com convenções fixas:
 * cabeçalho de metadados em negrito, seções numeradas e marcadores de
 * confiabilidade em code spans. Estes tipos são a forma estruturada disso.
 */

/** Marcadores definidos em 00-meta/CONVENCOES.md §1, normalizados sem acento. */
export type MarkerId =
  | 'CANONICO'
  | 'ATESTADO'
  | 'CRENCA'
  | 'DISPUTADO'
  | 'LACUNA'
  | 'PROPOSTA';

export interface MarkerMeta {
  id: MarkerId;
  /** Rótulo como aparece no acervo, com acentuação. */
  label: string;
  /** Explicação curta, vinda das convenções. */
  meaning: string;
}

export type MarkerTally = Partial<Record<MarkerId, number>>;

/** Uma referência a outro documento do acervo. */
export interface DocRef {
  /** Caminho do documento no repo, ex.: `04-bestiario/dragoes/README.md`. */
  path: string;
  /** Rota no site, ex.: `/c/bestiario/dragoes`. */
  href: string;
  /** Título legível, quando conhecido. */
  label: string;
}

/** Cabeçalho padrão descrito em CONVENCOES.md §3. */
export interface DocHeader {
  classificacao: string | null;
  /** Última parte da classificação: `classe`, `espécie`, … */
  subtipo: string | null;
  status: string | null;
  fontesInternas: string[];
  documentosRelacionados: DocRef[];
  documentosDerivados: DocRef[];
  ultimaAtualizacao: string | null;
  registradaEm: string | null;
  /** Pares não reconhecidos, preservados para não perder informação. */
  extras: Array<{ key: string; value: string }>;
}

export interface DocSection {
  /** Âncora estável, ex.: `s1-descricao-geral`. */
  id: string;
  /** Número da seção quando o título é numerado (`## 1. …`). */
  number: string | null;
  title: string;
  level: 2 | 3;
  html: string;
  markers: MarkerTally;
  /** Seção cujo conteúdo é só `[LACUNA]`. */
  isGap: boolean;
  children: DocSection[];
}

export type DocKind = 'entrada' | 'narrativa' | 'indice-categoria' | 'meta';

export interface BreachDoc {
  path: string;
  categorySlug: string;
  slug: string;
  title: string;
  kind: DocKind;
  header: DocHeader;
  /** Texto livre entre o cabeçalho e a primeira seção, já em HTML. */
  introHtml: string;
  sections: DocSection[];
  markers: MarkerTally;
  gapCount: number;
  /** Primeira frase útil, para cartões e busca. */
  excerpt: string;
  /** Texto puro, para o índice de busca. */
  plain: string;
  githubUrl: string;
  updatedAt: string | null;
  /** URL da ilustração de abertura, quando a entidade tiver uma. */
  hero: string | null;
  /** Legenda da ilustração de abertura, tirada do texto alternativo. */
  heroAlt: string | null;
  /**
   * Miniatura para listas: o hero, ou, num documento solto (que não tem hero),
   * a imagem citada logo abaixo do título.
   */
  capa: string | null;
}

/** Um documento reduzido ao que um cartão de lista mostra. */
export interface Resumo {
  path: string;
  title: string;
  href: string;
  categorySlug: string;
  subtipo: string | null;
  kind: DocKind;
  excerpt: string;
  markers: MarkerTally;
  status: string | null;
  gapCount: number;
  updatedAt: string | null;
  capa: string | null;
  /** Ids das eras em que o documento se passa. */
  eras: string[];
}

export interface NoResumo {
  doc: Resumo;
  children: NoResumo[];
}

/** Uma entidade e as entidades contidas nela — uma classe e suas espécies. */
export interface DocNode {
  doc: BreachDoc;
  children: DocNode[];
}

export interface BreachCategory {
  /** Prefixo numérico da pasta, ex.: `04`. */
  number: string;
  /** Pasta no repo, ex.: `04-bestiario`. */
  dir: string;
  /** Slug de rota, ex.: `bestiario`. */
  slug: string;
  title: string;
  description: string;
  status: string;
  /** Documentos da categoria, sem o README. Plano, em qualquer profundidade. */
  docs: BreachDoc[];
  /** Os mesmos documentos, aninhados como estão no acervo. */
  tree: DocNode[];
  /** Itens da seção "Lacunas desta categoria". */
  gaps: string[];
  githubUrl: string;
  updatedAt: string | null;
  hero: string | null;
}

/** Uma linha das tabelas de 00-meta/INDICE-CANONICO.md. */
export interface IndexEntry {
  categoria: string;
  entidade: string;
  status: string;
  path: string | null;
  href: string | null;
  fato: string;
}

export interface ChangelogEntry {
  date: string;
  title: string;
  html: string;
  plain: string;
}

/** Documento reduzido ao que a busca client-side precisa. */
export interface SearchRecord {
  title: string;
  href: string;
  categoria: string;
  subtipo: string | null;
  excerpt: string;
  headings: string;
  body: string;
  /** Miniatura do documento, quando há. */
  capa: string | null;
  /** Ids das eras em que o documento se passa. */
  eras: string[];
}

export interface Compendium {
  categories: BreachCategory[];
  docs: BreachDoc[];
  index: IndexEntry[];
  changelog: ChangelogEntry[];
  conventions: BreachDoc | null;
  indexDoc: BreachDoc | null;
  /** README da raiz do acervo — o texto da página inicial. */
  readme: BreachDoc | null;
  /** Lacunas prioritárias declaradas no índice canônico. */
  priorityGaps: Array<{ lacuna: string; onde: string; impacto: string }>;
  /** As eras da linha do tempo, em ordem (06-historia/linha-do-tempo/). */
  eras: Era[];
  /** Caminho de cada documento → as eras em que ele se passa. */
  erasPorCaminho: Record<string, EraRef[]>;
  /** Documento → os documentos que ele cita (cabeçalho e corpo). */
  ligacoes: Record<string, string[]>;
  reinos: Reino[];
  personagens: Personagem[];
  grafo: Grafo;
  galeria: Ilustracao[];
  /** O acervo na ordem da linha do tempo, sem repetição. */
  leitura: Cartao[];
  /** As raízes da Thalae listadas no acervo. */
  raizes: RaizDoAcervo[];
  /** Os nomes em Thalae registrados, com as raízes de cada um. */
  nomesThalae: NomeDoAcervo[];
  /** O cofre do modo administrador (`00-meta/cofre.json`), quando existe. */
  cofre: string | null;
  /** Contradições em aberto declaradas no índice canônico. */
  contradictions: Array<{ n: string; descricao: string; documentos: string; status: string }>;
  stats: {
    docs: number;
    categories: number;
    narratives: number;
    markers: MarkerTally;
    gaps: number;
    updatedAt: string | null;
  };
  source: {
    owner: string;
    repo: string;
    ref: string;
    url: string;
    fetchedAt: string;
  };
}
