/**
 * API do acervo.
 *
 * Ponto único de consulta usado pelas páginas. Monta o compêndio inteiro uma
 * vez por processo de build e serve recortes dele — categorias, documentos,
 * índice canônico, registro de alterações e índice de busca.
 */

import type {
  BreachCategory,
  BreachDoc,
  ChangelogEntry,
  Compendium,
  DocNode,
  IndexEntry,
  NoResumo,
  SearchRecord,
} from './types';
import {
  githubUrlFor,
  listMarkdownFiles,
  listRepoFiles,
  readMarkdown,
  REPO_URL,
  SOURCE,
  sourceDescription,
} from './source';
import { ilustracaoDe, pastaDe, urlDaImagem } from './imagens';
import { labelFromPath, listItemsUnder, parseDocument, tableRows, tituloDe } from './parse';
import { renderMarkdown, toPlainText, type Titulos } from './markdown';
import { mergeTallies, tallyTotal } from './markers';
import { hrefForPath, normalizeDocPath, parseCategoryDir, slugify } from './slug';
import { CAMINHO_LINHA_DO_TEMPO, erasPorDocumento, lerLinhaDoTempo } from './linhaDoTempo';
import type { EraRef } from './linhaDoTempo';
import type { Cartao } from './mundo';
import {
  cartaoDe, montarGaleria, montarGrafo, montarPersonagens, montarReinos,
  referenciasDe,
} from './mundo';
import { lerNomes, lerRaizes } from '@/lib/thalae/raizes';
import { CAMINHO_COFRE, lerDocumentoDoCofre } from './cofre';

/** Arquivos que não viram página. O README da raiz vira a página inicial. */
const EXCLUDED = new Set(['CLAUDE.md']);
const META_DIR = '00-meta';

function isEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => !cell || /^\*?\(?(vazio|nenhum[ao]?)\)?\*?$/i.test(cell.replace(/\*/g, '')));
}

function stripCode(value: string): string {
  return value.replace(/`/g, '').trim();
}

/** Divide um markdown em blocos por título `##`. */
function sectionBlocks(markdown: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const lines = markdown.split('\n');
  let title: string | null = null;
  let body: string[] = [];
  const flush = (): void => {
    if (title !== null) blocks.set(title, body.join('\n'));
  };
  for (const line of lines) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      title = heading[1].trim();
      body = [];
      continue;
    }
    if (title !== null) body.push(line);
  }
  flush();
  return blocks;
}

function parseCanonicalIndex(markdown: string): {
  entries: IndexEntry[];
  priorityGaps: Compendium['priorityGaps'];
  contradictions: Compendium['contradictions'];
} {
  const blocks = sectionBlocks(markdown);
  const entries: IndexEntry[] = [];
  const priorityGaps: Compendium['priorityGaps'] = [];
  const contradictions: Compendium['contradictions'] = [];

  for (const [title, body] of blocks) {
    const rows = tableRows(body);
    if (rows.length < 2) continue;
    const data = rows.slice(1).filter((cells) => !isEmptyRow(cells));

    if (/contradi/i.test(title)) {
      for (const cells of data) {
        contradictions.push({
          n: cells[0] ?? '',
          descricao: cells[1] ?? '',
          documentos: cells[2] ?? '',
          status: cells[3] ?? '',
        });
      }
      continue;
    }
    if (/lacunas/i.test(title)) {
      for (const cells of data) {
        priorityGaps.push({
          lacuna: stripCode(cells[0] ?? ''),
          onde: stripCode(cells[1] ?? ''),
          impacto: cells[2] ?? '',
        });
      }
      continue;
    }

    for (const cells of data) {
      const path = stripCode(cells[2] ?? '') || null;
      entries.push({
        categoria: title,
        entidade: stripCode(cells[0] ?? ''),
        status: cells[1] ?? '',
        path,
        href: path ? hrefForPath(path) : null,
        fato: cells[3] ?? '',
      });
    }
  }

  return { entries, priorityGaps, contradictions };
}

async function parseChangelog(markdown: string, titulos: Titulos): Promise<ChangelogEntry[]> {
  const blocks = sectionBlocks(markdown);
  const entries: ChangelogEntry[] = [];
  for (const [title, body] of blocks) {
    const match = /^(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.*)$/.exec(title);
    if (!match) continue; // ignora a seção "Formato de entrada"
    const clean = body.replace(/^\s*-{3,}\s*$/gm, '').trim();
    entries.push({
      date: match[1],
      title: match[2].trim(),
      html: await renderMarkdown(clean, `${META_DIR}/REGISTRO-DE-ALTERACOES.md`, titulos),
      plain: toPlainText(clean),
    });
  }
  return entries;
}

/**
 * Aninha as entidades de uma categoria como estão no acervo: a espécie dentro
 * da pasta da classe vira filha do documento da classe (CONVENCOES.md §6).
 */
function buildTree(entries: BreachDoc[]): DocNode[] {
  const nodes = new Map<string, DocNode>();
  for (const doc of entries) nodes.set(doc.slug, { doc, children: [] });

  const roots: DocNode[] = [];
  for (const node of nodes.values()) {
    const corte = node.doc.slug.lastIndexOf('/');
    const pai = corte === -1 ? null : nodes.get(node.doc.slug.slice(0, corte));
    if (pai) pai.children.push(node);
    else roots.push(node);
  }

  const ordenar = (lista: DocNode[]): DocNode[] => {
    lista.sort((a, b) => a.doc.title.localeCompare(b.doc.title, 'pt-BR'));
    for (const node of lista) ordenar(node.children);
    return lista;
  };
  return ordenar(roots);
}

/**
 * A imagem citada logo abaixo do título, quando há uma — é como os documentos
 * soltos, que não têm hero, abrem com ilustração.
 */
function capaDoTopo(caminho: string, markdown: string, acervo: Set<string>): string | null {
  const topo = markdown.split('\n').slice(0, 4).join('\n');
  const citada = /!\[[^\]]*\]\(([^)\s]+)\)/.exec(topo)?.[1];
  if (!citada || /^https?:/i.test(citada)) return null;
  const pasta = pastaDe(caminho);
  const noAcervo = (pasta ? `${pasta}/` : '') + citada.replace(/^\.\//, '');
  return acervo.has(noAcervo) ? urlDaImagem(noAcervo) : null;
}

/** Título de cada documento, pela rota do site. */
function titulosPorRota(files: string[], raws: Map<string, string>): Map<string, string> {
  const titulos = new Map<string, string>();
  for (const file of files) {
    const rota = hrefForPath(file);
    if (rota) titulos.set(rota, tituloDe(raws.get(file) ?? '', file));
  }
  return titulos;
}

async function build(): Promise<Compendium> {
  const todos = await listRepoFiles();
  const acervo = new Set(todos);
  const files = (await listMarkdownFiles()).filter((file) => !EXCLUDED.has(file));
  const raws = new Map<string, string>();
  await Promise.all(
    files.map(async (file) => {
      raws.set(file, await readMarkdown(file));
    }),
  );

  // Os títulos saem antes de tudo, do bruto: assim cada documento já nasce com
  // as referências aos outros rotuladas pelo título.
  const titulos: Titulos = titulosPorRota(files, raws);

  const docs = await Promise.all(
    files.map((file) => parseDocument(file, raws.get(file) as string, titulos)),
  );
  for (const doc of docs) {
    doc.hero = ilustracaoDe(doc.path, acervo);
    doc.capa = doc.hero ?? capaDoTopo(doc.path, raws.get(doc.path) ?? '', acervo);
  }

  const byPath = new Map(docs.map((doc) => [doc.path, doc]));

  // Segunda passagem: agora que todos os títulos são conhecidos, os links
  // entre documentos deixam de usar o nome de arquivo como rótulo.
  for (const doc of docs) {
    for (const ref of [...doc.header.documentosRelacionados, ...doc.header.documentosDerivados]) {
      ref.label = byPath.get(ref.path)?.title ?? labelFromPath(ref.path);
    }
  }

  const dirs = [...new Set(files.map((file) => file.split('/')[0]))]
    .filter((dir) => parseCategoryDir(dir) && dir !== META_DIR)
    .sort();

  const categories: BreachCategory[] = dirs.map((dir) => {
    const parsed = parseCategoryDir(dir) as { number: string; slug: string };
    const readmePath = `${dir}/README.md`;
    const readme = byPath.get(readmePath);
    const readmeRaw = raws.get(readmePath) ?? '';
    const entries = docs
      .filter((doc) => doc.path.startsWith(`${dir}/`) && doc.kind !== 'indice-categoria')
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

    return {
      number: parsed.number,
      dir,
      slug: parsed.slug,
      title: readme?.title ?? labelFromPath(readmePath),
      description: readme ? toPlainText(readme.excerpt) : '',
      status: readme?.header.status ?? (entries.length ? 'em construção' : 'vazio'),
      docs: entries,
      tree: buildTree(entries),
      gaps: listItemsUnder(readmeRaw, /lacunas/i),
      githubUrl: `${REPO_URL}/tree/${SOURCE.ref}/${dir}`,
      updatedAt: readme?.updatedAt ?? null,
      hero: readme?.hero ?? null,
    };
  });

  const indexRaw = raws.get(`${META_DIR}/INDICE-CANONICO.md`) ?? '';
  const changelogRaw = raws.get(`${META_DIR}/REGISTRO-DE-ALTERACOES.md`) ?? '';
  const indice = parseCanonicalIndex(indexRaw);
  const { priorityGaps, contradictions } = indice;
  // Linha do índice cujo documento é do Ateliê não vai para o público.
  const entries = indice.entries.filter((entry) => !entry.path || acervo.has(normalizeDocPath(entry.path)));
  const eras = await lerLinhaDoTempo(raws.get(CAMINHO_LINHA_DO_TEMPO) ?? '', titulos);

  const erasPorCaminho = Object.fromEntries(erasPorDocumento(eras));

  const existentes = new Set(docs.map((doc) => doc.path));
  const ligacoes: Record<string, string[]> = {};
  for (const doc of docs) {
    if (doc.kind === 'meta') continue;
    ligacoes[doc.path] = referenciasDe(doc.path, raws.get(doc.path) ?? '', existentes);
  }

  // A ordem de leitura: os documentos das eras, na ordem em que a linha do
  // tempo os lista, cada um só na primeira era em que aparece.
  const leitura = [...new Set(eras.flatMap((era) => era.documentos))]
    .map((caminho) => byPath.get(caminho))
    .filter((doc): doc is BreachDoc => Boolean(doc) && (doc as BreachDoc).kind === 'entrada')
    .map(cartaoDe);

  const cofre = lerDocumentoDoCofre(raws.get(CAMINHO_COFRE) ?? '');

  const entryDocs = docs.filter((doc) => doc.kind === 'entrada' || doc.kind === 'narrativa');
  const dates = docs.map((doc) => doc.updatedAt).filter((date): date is string => Boolean(date));

  return {
    categories,
    docs,
    index: entries,
    changelog: await parseChangelog(changelogRaw, titulos),
    conventions: byPath.get(`${META_DIR}/CONVENCOES.md`) ?? null,
    indexDoc: byPath.get(`${META_DIR}/INDICE-CANONICO.md`) ?? null,
    readme: byPath.get('README.md') ?? null,
    priorityGaps,
    eras,
    erasPorCaminho,
    ligacoes,
    reinos: montarReinos(docs, ligacoes, erasPorCaminho, eras.map((era) => era.id)),
    personagens: montarPersonagens(docs, ligacoes, erasPorCaminho),
    grafo: montarGrafo(docs, ligacoes, erasPorCaminho),
    galeria: montarGaleria(todos, docs, raws),
    leitura,
    raizes: lerRaizes(raws.get('01-cosmologia/thalae/README.md') ?? ''),
    nomesThalae: lerNomes(raws.get('01-cosmologia/thalae/README.md') ?? ''),
    cofre,
    contradictions,
    stats: {
      docs: entryDocs.length,
      categories: categories.length,
      narratives: docs.filter((doc) => doc.kind === 'narrativa').length,
      markers: mergeTallies(entryDocs.map((doc) => doc.markers)),
      gaps: entryDocs.reduce((sum, doc) => sum + doc.gapCount, 0),
      updatedAt: dates.sort().pop() ?? null,
    },
    source: {
      owner: SOURCE.owner,
      repo: SOURCE.repo,
      ref: SOURCE.ref,
      url: REPO_URL,
      fetchedAt: new Date().toISOString(),
    },
  };
}

let pending: Promise<Compendium> | null = null;

export function getCompendium(): Promise<Compendium> {
  pending ??= build();
  return pending;
}

/**
 * Quando este site foi construído.
 *
 * É a régua do aviso de página atrasada: gravação anterior a isto já está no
 * ar, gravação posterior ainda não.
 */
export async function getGeradoEm(): Promise<string> {
  const compendium = await getCompendium();
  return compendium.source.fetchedAt;
}

export async function getCategories(): Promise<BreachCategory[]> {
  return (await getCompendium()).categories;
}

export async function getCategory(slug: string): Promise<BreachCategory | null> {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function getDoc(categorySlug: string, docSlug: string): Promise<BreachDoc | null> {
  const compendium = await getCompendium();
  return (
    compendium.docs.find(
      (doc) => doc.categorySlug === categorySlug && doc.slug === docSlug && doc.kind !== 'indice-categoria',
    ) ?? null
  );
}

/** A árvore de uma categoria, reduzida ao que os cartões mostram. */
export async function getResumos(nodes: DocNode[]): Promise<NoResumo[]> {
  const { erasPorCaminho } = await getCompendium();
  const reduzir = (node: DocNode): NoResumo => ({
    doc: {
      path: node.doc.path,
      title: node.doc.title,
      href: `/c/${node.doc.categorySlug}/${node.doc.slug}`,
      categorySlug: node.doc.categorySlug,
      subtipo: node.doc.header.subtipo,
      kind: node.doc.kind,
      excerpt: node.doc.excerpt,
      markers: node.doc.markers,
      status: node.doc.header.status,
      gapCount: node.doc.gapCount,
      updatedAt: node.doc.updatedAt,
      capa: node.doc.capa,
      eras: (erasPorCaminho[node.doc.path] ?? []).map((era) => era.id),
    },
    children: node.children.map(reduzir),
  });
  return nodes.map(reduzir);
}

/** O documento anterior e o seguinte na ordem da linha do tempo. */
export async function getVizinhosDeLeitura(path: string): Promise<{ antes: Cartao | null; depois: Cartao | null; posicao: number; total: number } | null> {
  const { leitura } = await getCompendium();
  const i = leitura.findIndex((item) => item.path === path);
  if (i === -1) return null;
  return { antes: leitura[i - 1] ?? null, depois: leitura[i + 1] ?? null, posicao: i + 1, total: leitura.length };
}

/** As relações com nome que chegam a um documento, vindas dos outros. */
export async function getRelacoesQueChegam(path: string): Promise<Array<{ verbo: string; doc: BreachDoc }>> {
  const compendium = await getCompendium();
  return compendium.docs.flatMap((doc) =>
    doc.header.relacoes.filter((r) => r.path === path).map((r) => ({ verbo: r.verbo, doc })),
  );
}

/** Documentos que citam um dado documento — retrolinks. */
/** As eras em que um documento se passa, segundo a linha do tempo. */
export async function getErasDe(path: string): Promise<EraRef[]> {
  const compendium = await getCompendium();
  return compendium.erasPorCaminho[path] ?? [];
}

export async function getBacklinks(path: string): Promise<BreachDoc[]> {
  const compendium = await getCompendium();
  return compendium.docs.filter(
    (doc) =>
      doc.path !== path &&
      doc.kind !== 'indice-categoria' &&
      [...doc.header.documentosRelacionados, ...doc.header.documentosDerivados].some(
        (ref) => ref.path === path,
      ),
  );
}

export async function getSearchIndex(): Promise<SearchRecord[]> {
  const compendium = await getCompendium();
  const records: SearchRecord[] = [];
  const erasDe = (path: string): string[] => (compendium.erasPorCaminho[path] ?? []).map((era) => era.id);

  for (const category of compendium.categories) {
    records.push({
      title: category.title,
      href: `/c/${category.slug}`,
      categoria: 'Categoria',
      subtipo: null,
      excerpt: category.description,
      headings: category.docs.map((doc) => doc.title).join(' · '),
      body: category.gaps.join(' '),
      capa: category.hero,
      eras: [],
    });
    for (const doc of category.docs) {
      records.push({
        title: doc.title,
        href: `/c/${category.slug}/${doc.slug}`,
        categoria: category.title,
        subtipo: doc.header.subtipo,
        excerpt: doc.excerpt,
        headings: doc.sections.map((section) => section.title).join(' · '),
        body: doc.plain.slice(0, 4000),
        capa: doc.capa,
        eras: erasDe(doc.path),
      });
    }
  }

  for (const doc of compendium.docs.filter((d) => d.kind === 'meta')) {
    const href = hrefForPath(doc.path);
    if (!href) continue;
    records.push({
      title: doc.title,
      href,
      categoria: 'Meta',
      subtipo: null,
      excerpt: doc.excerpt,
      headings: doc.sections.map((section) => section.title).join(' · '),
      body: doc.plain.slice(0, 4000),
      capa: null,
      eras: [],
    });
  }

  return records;
}

export { CAMINHO_LINHA_DO_TEMPO };
export { REPO_URL, SOURCE, sourceDescription, githubUrlFor, tallyTotal, slugify };
