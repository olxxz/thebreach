/**
 * O mundo por cima do acervo: reinos, personagens, ligações e ilustrações.
 *
 * O acervo é organizado por tipo de coisa (cosmologia, geografia, forças…), e
 * quem lê pergunta por outra régua: "o que existe em Luora?", "quem serve a
 * quem?". Nada disto é escrito à mão — tudo sai das referências que os
 * documentos já fazem uns aos outros e das pastas em que moram.
 */

import type { BreachDoc } from './types';
import type { EraRef } from './linhaDoTempo';
import { ehHeroDe, ehImagem, pastaDe, urlDaImagem } from './imagens';
import { CAMINHO_LINHA_DO_TEMPO } from './rotas';
import { looksLikeDocPath, normalizeDocPath, resolverRefRelativa, resolverRelativo } from './slug';

/** Um documento reduzido ao que um cartão precisa. */
export interface Cartao {
  path: string;
  title: string;
  href: string;
  capa: string | null;
  excerpt: string;
  categorySlug: string;
  subtipo: string | null;
}

export interface GrupoDoReino {
  id: 'governo' | 'lugares' | 'forcas' | 'artefatos' | 'instituicoes' | 'criaturas';
  titulo: string;
  itens: Cartao[];
}

export interface Reino extends Cartao {
  /** Âncora na página dos reinos. */
  id: string;
  eras: EraRef[];
  grupos: GrupoDoReino[];
}

export interface Personagem extends Cartao {
  /** Nefando, Deviante… — o subtipo da classificação. */
  papel: string;
  /** Reinos a que está ligado, pelo caminho do documento do reino. */
  reinos: string[];
  eras: EraRef[];
}

export interface Ilustracao {
  src: string;
  /** Caminho do arquivo no acervo. */
  caminho: string;
  legenda: string;
  hero: boolean;
  doc: { title: string; href: string; categorySlug: string } | null;
}

export interface NoDoGrafo {
  path: string;
  title: string;
  href: string;
  categorySlug: string;
  capa: string | null;
  eras: string[];
}

export interface Grafo {
  nos: NoDoGrafo[];
  /** Pares de índices em `nos`, sem direção e sem repetição. */
  arestas: Array<[number, number]>;
  /** As ligações que têm nome: de quem, para quem, e o verbo. */
  relacoes: Array<{ de: number; para: number; verbo: string }>;
}

/** Pastas cujas entidades são personagens: quem tem nome, rosto e vontade. */
const PASTAS_DE_PERSONAGENS = ['01-cosmologia/testemunhas-nefandas', '01-cosmologia/deviantes'];

/** Pasta cujas entidades de primeiro nível são os reinos. */
const PASTA_DOS_REINOS = '02-geografia';

const hrefDe = (doc: BreachDoc): string => `/c/${doc.categorySlug}/${doc.slug}`;

export function cartaoDe(doc: BreachDoc): Cartao {
  return {
    path: doc.path,
    title: doc.title,
    href: hrefDe(doc),
    capa: doc.capa,
    excerpt: doc.excerpt,
    categorySlug: doc.categorySlug,
    subtipo: doc.header.subtipo,
  };
}

function semCercas(markdown: string): string {
  return markdown.replace(/^(`{3,}|~{3,})[\s\S]*?^\1\s*$/gm, '');
}

/**
 * Os documentos que um documento cita — no cabeçalho ou no corpo, por link
 * relativo ou por caminho entre crases (CONVENCOES.md §3 e §6).
 */
export function referenciasDe(caminho: string, markdown: string, existentes: Set<string>): string[] {
  const pasta = pastaDe(caminho);
  const texto = semCercas(markdown);
  const achados = new Set<string>();

  for (const [, exclama, alvo] of texto.matchAll(/(!?)\[[^\]]*\]\(\s*<?([^)>\s]+)>?[^)]*\)/g)) {
    if (exclama) continue;
    const resolvido = resolverRefRelativa(pasta, alvo);
    if (resolvido) achados.add(normalizeDocPath(resolvido));
  }
  for (const [, crase] of texto.matchAll(/`([^`\n]+)`/g)) {
    if (looksLikeDocPath(crase)) achados.add(normalizeDocPath(crase));
  }

  achados.delete(caminho);
  return [...achados].filter((alvo) => existentes.has(alvo));
}

/** Documento → os documentos vizinhos, nos dois sentidos. */
function vizinhanca(ligacoes: Record<string, string[]>): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  const ligar = (a: string, b: string): void => {
    if (!mapa.has(a)) mapa.set(a, new Set());
    (mapa.get(a) as Set<string>).add(b);
  };
  for (const [de, alvos] of Object.entries(ligacoes)) {
    for (const para of alvos) {
      ligar(de, para);
      ligar(para, de);
    }
  }
  return mapa;
}

function ehPersonagem(doc: BreachDoc): boolean {
  return PASTAS_DE_PERSONAGENS.some((pasta) => {
    if (!doc.path.startsWith(`${pasta}/`)) return false;
    // Só as entidades de dentro: o README da própria pasta é a classe.
    const resto = doc.path.slice(pasta.length + 1);
    return /^[^/]+\/README\.md$/i.test(resto);
  });
}

function ehReino(doc: BreachDoc): boolean {
  return new RegExp(`^${PASTA_DOS_REINOS}/[^/]+/README\\.md$`, 'i').test(doc.path);
}

const porTitulo = (a: Cartao, b: Cartao): number => a.title.localeCompare(b.title, 'pt-BR');

/** Nefandos antes dos Deviantes: quem manda vem primeiro. */
function ordemDePapel(papel: string): number {
  return /nefando/i.test(papel) ? 0 : 1;
}

export function montarPersonagens(
  docs: BreachDoc[],
  ligacoes: Record<string, string[]>,
  erasPorCaminho: Record<string, EraRef[]>,
): Personagem[] {
  const vizinhos = vizinhanca(ligacoes);
  const reinos = new Set(docs.filter(ehReino).map((doc) => doc.path));
  return docs
    .filter(ehPersonagem)
    .map((doc) => ({
      ...cartaoDe(doc),
      capa: doc.hero ?? doc.capa,
      papel: doc.header.subtipo ?? 'personagem',
      reinos: [...(vizinhos.get(doc.path) ?? [])].filter((path) => reinos.has(path)).sort(),
      eras: erasPorCaminho[doc.path] ?? [],
    }))
    .sort((a, b) => ordemDePapel(a.papel) - ordemDePapel(b.papel) || porTitulo(a, b));
}

export function montarReinos(
  docs: BreachDoc[],
  ligacoes: Record<string, string[]>,
  erasPorCaminho: Record<string, EraRef[]>,
  /** Ids das eras na ordem da linha do tempo: é a ordem em que os reinos saem. */
  ordemDasEras: string[] = [],
): Reino[] {
  const ordemDaEra = (id: string): number => {
    const i = ordemDasEras.indexOf(id);
    return i === -1 ? 999 : i;
  };
  const vizinhos = vizinhanca(ligacoes);
  const porCaminho = new Map(docs.map((doc) => [doc.path, doc]));

  return docs
    .filter(ehReino)
    .map((reino) => {
      const pasta = pastaDe(reino.path);
      const lugares = docs.filter((doc) => doc.path.startsWith(`${pasta}/`) && doc.path !== reino.path);
      const dentro = new Set([reino.path, ...lugares.map((doc) => doc.path)]);

      // Tudo o que cita o reino ou um lugar dele, ou é citado por eles.
      const ao_redor = new Set<string>();
      for (const membro of dentro) {
        for (const vizinho of vizinhos.get(membro) ?? []) {
          if (!dentro.has(vizinho)) ao_redor.add(vizinho);
        }
      }
      const fora = [...ao_redor]
        .map((path) => porCaminho.get(path))
        .filter((doc): doc is BreachDoc => Boolean(doc) && (doc as BreachDoc).kind === 'entrada');

      const daCategoria = (slug: string): Cartao[] =>
        fora.filter((doc) => doc.categorySlug === slug).map(cartaoDe).sort(porTitulo);

      const governo = fora
        .filter(ehPersonagem)
        .sort(
          (a, b) =>
            ordemDePapel(a.header.subtipo ?? '') - ordemDePapel(b.header.subtipo ?? '') ||
            a.title.localeCompare(b.title, 'pt-BR'),
        )
        .map((doc) => {
          // O papel sai da relação com nome: governa este reino, ou serve a alguém.
          const aqui = doc.header.relacoes.find((r) => r.path === reino.path);
          const serve = doc.header.relacoes.find((r) => /^serve/i.test(r.verbo));
          const papel = aqui ? aqui.verbo : serve ? `${serve.verbo} ${serve.label}` : doc.header.subtipo;
          return { ...cartaoDe(doc), capa: doc.hero ?? doc.capa, subtipo: papel };
        });

      const grupos: GrupoDoReino[] = [
        { id: 'governo' as const, titulo: 'Quem governa', itens: governo },
        { id: 'lugares' as const, titulo: 'Lugares', itens: lugares.map(cartaoDe).sort(porTitulo) },
        { id: 'forcas' as const, titulo: 'Forças e segredos', itens: daCategoria('forcas') },
        { id: 'artefatos' as const, titulo: 'Artefatos', itens: daCategoria('artefatos') },
        { id: 'instituicoes' as const, titulo: 'Instituições', itens: daCategoria('instituicoes') },
        { id: 'criaturas' as const, titulo: 'Criaturas', itens: daCategoria('bestiario') },
      ].filter((grupo) => grupo.itens.length > 0);

      return {
        ...cartaoDe(reino),
        capa: reino.hero ?? reino.capa,
        id: pasta.split('/').pop() ?? reino.slug,
        eras: erasPorCaminho[reino.path] ?? [],
        grupos,
      };
    })
    .sort((a, b) => {
      // Na ordem da linha do tempo; empate, pelo nome.
      const era = (reino: Reino): string => reino.eras[0]?.id ?? 'zz';
      return ordemDaEra(era(a)) - ordemDaEra(era(b)) || porTitulo(a, b);
    });
}

export function montarGrafo(
  docs: BreachDoc[],
  ligacoes: Record<string, string[]>,
  erasPorCaminho: Record<string, EraRef[]>,
): Grafo {
  // A linha do tempo cita o acervo inteiro: no desenho ela seria um nó no
  // meio de tudo, escondendo as ligações que dizem alguma coisa.
  const nosDocs = docs.filter((doc) => doc.kind === 'entrada' && doc.path !== CAMINHO_LINHA_DO_TEMPO);
  const indice = new Map(nosDocs.map((doc, i) => [doc.path, i]));
  const vistos = new Set<string>();
  const arestas: Array<[number, number]> = [];

  for (const [de, alvos] of Object.entries(ligacoes)) {
    const a = indice.get(de);
    if (a === undefined) continue;
    for (const para of alvos) {
      const b = indice.get(para);
      if (b === undefined || a === b) continue;
      const chave = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      arestas.push(a < b ? [a, b] : [b, a]);
    }
  }

  return {
    nos: nosDocs.map((doc) => ({
      path: doc.path,
      title: doc.title,
      href: hrefDe(doc),
      categorySlug: doc.categorySlug,
      capa: doc.capa,
      eras: (erasPorCaminho[doc.path] ?? []).map((era) => era.id),
    })),
    arestas,
    relacoes: nosDocs.flatMap((doc, de) =>
      doc.header.relacoes.flatMap((relacao) => {
        const para = indice.get(relacao.path);
        return para === undefined ? [] : [{ de, para, verbo: relacao.verbo }];
      }),
    ),
  };
}

/**
 * Todas as ilustrações do acervo, cada uma com o documento a que pertence e a
 * legenda — o texto alternativo com que o documento a cita.
 */
export function montarGaleria(
  arquivos: string[],
  docs: BreachDoc[],
  raws: Map<string, string>,
): Ilustracao[] {
  const porCaminho = new Map(docs.map((doc) => [doc.path, doc]));

  // Imagem → quem a cita e com que legenda.
  const citacoes = new Map<string, { doc: BreachDoc; legenda: string }>();
  for (const doc of docs) {
    const pasta = pastaDe(doc.path);
    for (const [, alt, alvo] of (raws.get(doc.path) ?? '').matchAll(/!\[([^\]]*)\]\(\s*<?([^)>\s]+)>?[^)]*\)/g)) {
      if (/^(https?:|data:)/i.test(alvo)) continue;
      const caminho = alvo.startsWith('/') ? alvo.slice(1) : resolverRelativo(pasta, alvo);
      if (!citacoes.has(caminho)) citacoes.set(caminho, { doc, legenda: alt.trim() });
    }
  }

  const imagens = arquivos.filter((arquivo) => ehImagem(arquivo) && /^\d{2}-|^hero\./.test(arquivo));
  return imagens
    .map((caminho) => {
      const pasta = pastaDe(caminho);
      const citada = citacoes.get(caminho);
      const dono = citada?.doc ?? porCaminho.get(pasta ? `${pasta}/README.md` : 'README.md') ?? null;
      const rota = dono
        ? dono.kind === 'indice-categoria'
          ? `/c/${dono.categorySlug}`
          : dono.path === 'README.md'
            ? '/'
            : hrefDe(dono)
        : null;
      return {
        src: urlDaImagem(caminho),
        caminho,
        legenda: citada?.legenda || dono?.title || '',
        hero: ehHeroDe(pasta, caminho),
        doc: dono && rota ? { title: dono.title, href: rota, categorySlug: dono.categorySlug } : null,
      };
    })
    .sort((a, b) => a.caminho.localeCompare(b.caminho));
}
