/**
 * Pipeline markdown → HTML.
 *
 * Além da conversão padrão (com tabelas GFM, que o acervo usa bastante),
 * três transformações próprias fazem o acervo virar site:
 *  - marcadores `[CANÔNICO]` viram selos com a fonte interna destacada;
 *  - referências a documentos e entidades viram links para as rotas do site;
 *  - tabelas ganham um contêiner com rolagem própria.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString as hastToString } from 'hast-util-to-string';
import { VFile } from 'vfile';
import type { Element, Root, RootContent } from 'hast';

import { MARKERS, parseMarkerToken } from './markers';
import { ehAudio, ehHeroDe, pastaDe, urlDaImagem } from './imagens';
import {
  hrefForPath,
  looksLikeDocPath,
  resolverRefRelativa,
  resolverRelativo,
  withBase,
} from './slug';

/** Títulos dos documentos do acervo, pela rota do site — rótulo das referências. */
export type Titulos = ReadonlyMap<string, string>;

interface Contexto {
  pasta?: string;
  titulos?: Titulos;
}

function contextoDe(file: VFile): Contexto {
  return (file.data as Contexto | undefined) ?? {};
}

/** Pasta do documento em processamento, para resolver caminhos relativos. */
function pastaDoArquivo(file: VFile): string {
  const { pasta } = contextoDe(file);
  return typeof pasta === 'string' ? pasta : '';
}

function textNode(value: string): RootContent {
  return { type: 'text', value } as RootContent;
}

function element(tagName: string, properties: Element['properties'], children: RootContent[]): Element {
  return { type: 'element', tagName, properties, children } as Element;
}

/** `<code>[CRENÇA — Ordem X]</code>` → selo com rótulo e fonte. */
function rehypeMarkers() {
  return (tree: Root): void => {
    visit(tree, 'element', (node: Element, indexInParent, parent) => {
      if (node.tagName !== 'code' || !parent || indexInParent === undefined) return;
      const raw = hastToString(node).trim();
      if (!raw.startsWith('[')) return;
      const parsed = parseMarkerToken(raw);
      if (!parsed) return;

      const children: RootContent[] = [
        element('span', { className: ['marker__label'] }, [textNode(parsed.label)]),
      ];
      if (parsed.source) {
        children.push(element('span', { className: ['marker__source'] }, [textNode(parsed.source)]));
      }

      const badge = element(
        'span',
        {
          className: ['marker', `marker--${parsed.id.toLowerCase()}`],
          'data-marker': parsed.id,
          title: MARKERS[parsed.id].meaning,
        },
        children,
      );
      (parent as Element).children[indexInParent] = badge;
    });
  };
}

/** Blocos que carregam uma afirmação inteira: é neles que a camada é anotada. */
const BLOCOS_DE_AFIRMACAO = new Set(['p', 'li', 'tr', 'blockquote']);

/**
 * Anota em cada bloco a camada da afirmação — `data-camada="proposta"` — pelo
 * primeiro marcador que ele traz. É o que deixa o modo "só o cânone" esconder
 * propostas e lacunas sem reescrever o documento.
 */
function rehypeCamadas() {
  return (tree: Root): void => {
    const descer = (node: Root | Element, blocos: Element[]): void => {
      for (const filho of node.children) {
        if (filho.type !== 'element') continue;
        const marcador = filho.properties?.['data-marker'];
        if (typeof marcador === 'string') {
          // O bloco mais próximo ainda sem camada: o item da lista antes da
          // lista, o parágrafo antes da citação.
          const bloco = [...blocos].reverse().find((b) => b.properties['data-camada'] === undefined);
          const maisProximo = blocos[blocos.length - 1];
          if (bloco && bloco === maisProximo) bloco.properties['data-camada'] = marcador.toLowerCase();
          continue;
        }
        descer(filho, BLOCOS_DE_AFIRMACAO.has(filho.tagName) ? [...blocos, filho] : blocos);
      }
    };
    descer(tree, []);
  };
}

/**
 * Link cujo texto é só o caminho entre crases — `[`00-meta/X.md`](…)` — passa
 * a mostrar o título do documento; o caminho fica no `title`.
 */
function rotularPeloTitulo(link: Element, titulo: string | undefined): void {
  if (!titulo || link.children.length !== 1) return;
  const unico = link.children[0];
  if (unico.type !== 'element' || unico.tagName !== 'code') return;
  const caminho = hastToString(unico).trim();
  if (!looksLikeDocPath(caminho)) return;
  link.children = [textNode(titulo) as Element['children'][number]];
  link.properties.title = caminho;
}

/**
 * Referências entre documentos.
 * `<code>04-bestiario/dragoes/</code>` vira link, e links markdown para
 * documentos do acervo passam a apontar para a rota equivalente do site.
 */
function rehypeDocLinks() {
  return (tree: Root, file: VFile): void => {
    const pasta = pastaDoArquivo(file);
    const { titulos } = contextoDe(file);
    visit(tree, 'element', (node: Element, indexInParent, parent) => {
      if (node.tagName === 'img') {
        const src = typeof node.properties?.src === 'string' ? node.properties.src : null;
        if (!src || /^(https?:|data:)/i.test(src)) return;
        // CONVENCOES.md §8: as imagens são citadas por caminho relativo ao
        // documento — é isso que as faz renderizar também no GitHub.
        const noAcervo = src.startsWith('/')
          ? src.slice(1)
          : resolverRelativo(pasta, src);
        node.properties.src = urlDaImagem(noAcervo);
        node.properties.loading = 'lazy';
        node.properties.decoding = 'async';
        return;
      }

      if (node.tagName === 'a') {
        const href = typeof node.properties?.href === 'string' ? node.properties.href : null;
        if (!href) return;
        if (/^https?:/i.test(href)) {
          node.properties.target = '_blank';
          node.properties.rel = ['noreferrer', 'noopener'];
          node.properties.className = ['link-external'];
          return;
        }
        // Áudio citado por caminho relativo (a pronúncia de um nome): vira um
        // botão de ouvir. Quem toca é o componente Pronuncia, no navegador.
        if (ehAudio(href)) {
          const noAcervo = href.startsWith('/') ? href.slice(1) : resolverRelativo(pasta, href);
          node.tagName = 'button';
          node.properties = {
            type: 'button',
            className: ['pronuncia'],
            'data-audio': urlDaImagem(noAcervo),
            'aria-label': `Ouvir: ${hastToString(node).trim()}`,
          };
          return;
        }
        // O acervo cita outro documento por caminho relativo, como cita as
        // imagens: é o que faz o link funcionar também na leitura pelo GitHub.
        const caminho = resolverRefRelativa(pasta, href);
        if (!caminho) return;
        const route = hrefForPath(caminho);
        if (route) {
          const hash = href.includes('#') ? href.slice(href.indexOf('#') + 1) : '';
          node.properties.href = withBase(route) + (hash ? `#${hash}` : '');
          node.properties.className = ['link-internal'];
          rotularPeloTitulo(node, titulos?.get(route));
        }
        return;
      }

      if (node.tagName !== 'code' || !parent || indexInParent === undefined) return;
      // Já dentro de um link: não aninhar.
      if ((parent as Element).tagName === 'a') return;
      const raw = hastToString(node).trim();
      if (!looksLikeDocPath(raw)) return;
      const route = hrefForPath(raw);
      if (!route) return;

      // Com o título conhecido, a referência se lê como texto — "As seis
      // raças" em vez de `03-povos/seis-racas.md`; o caminho fica no `title`.
      const titulo = titulos?.get(route);
      (parent as Element).children[indexInParent] = titulo
        ? element('a', { href: withBase(route), className: ['doc-ref', 'doc-ref--titulo'], title: raw }, [
            textNode(titulo),
          ])
        : element('a', { href: withBase(route), className: ['doc-ref'] }, [
            element('code', {}, [textNode(raw)]),
          ]);
    });
  };
}

/**
 * A ilustração de abertura sai do corpo do texto: a página já a mostra no topo,
 * e o documento a cita para que ela apareça também no GitHub (CONVENCOES.md §8).
 * Sem isto, a mesma aquarela apareceria duas vezes na mesma tela.
 */
function rehypeSemHeroRepetido() {
  return (tree: Root, file: VFile): void => {
    const pasta = pastaDoArquivo(file);
    const ehHero = (no: RootContent): boolean => {
      if (no.type !== 'element' || no.tagName !== 'img') return false;
      const src = typeof no.properties?.src === 'string' ? no.properties.src : '';
      if (!src || /^(https?:|data:)/i.test(src)) return false;
      return ehHeroDe(pasta, src.startsWith('/') ? src.slice(1) : resolverRelativo(pasta, src));
    };

    visit(tree, 'element', (node: Element, indexInParent, parent) => {
      if (node.tagName !== 'p' || !parent || indexInParent === undefined) return;
      const conteudo = node.children.filter(
        (filho) => filho.type !== 'text' || filho.value.trim() !== '',
      );
      if (conteudo.length !== 1 || !ehHero(conteudo[0])) return;
      (parent as Element).children.splice(indexInParent, 1);
      // O nó seguinte tomou este índice: a visita continua nele.
      return indexInParent;
    });
  };
}

/** Tabelas do acervo são largas; cada uma rola dentro do próprio contêiner. */
function rehypeTableWrapper() {
  return (tree: Root): void => {
    visit(tree, 'element', (node: Element, indexInParent, parent) => {
      if (node.tagName !== 'table' || !parent || indexInParent === undefined) return;
      if ((parent as Element).tagName === 'div') return;
      (parent as Element).children[indexInParent] = element(
        'div',
        { className: ['md-table'] },
        [node as RootContent],
      );
    });
  };
}

/** Imagem sozinha no parágrafo vira figura, com o texto alternativo por legenda. */
function rehypeFiguras() {
  return (tree: Root): void => {
    visit(tree, 'element', (node: Element, indexInParent, parent) => {
      if (node.tagName !== 'p' || !parent || indexInParent === undefined) return;
      const filhos = node.children.filter(
        (filho) => filho.type !== 'text' || filho.value.trim() !== '',
      );
      if (filhos.length !== 1) return;
      const imagem = filhos[0];
      if (imagem.type !== 'element' || imagem.tagName !== 'img') return;

      const legenda = typeof imagem.properties?.alt === 'string' ? imagem.properties.alt.trim() : '';
      const conteudo: RootContent[] = [imagem as RootContent];
      if (legenda) {
        conteudo.push(element('figcaption', {}, [textNode(legenda)]));
      }
      (parent as Element).children[indexInParent] = element('figure', {}, conteudo);
    });
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, {
    behavior: 'wrap',
    properties: { className: ['heading-anchor'] },
  })
  .use(rehypeMarkers)
  .use(rehypeCamadas)
  // Antes do rehypeDocLinks: aqui o `src` ainda é o caminho relativo do acervo.
  .use(rehypeSemHeroRepetido)
  .use(rehypeDocLinks)
  .use(rehypeFiguras)
  .use(rehypeTableWrapper)
  .use(rehypeStringify, { allowDangerousHtml: false });

/**
 * `caminhoDoDocumento` é o caminho no acervo do documento de onde o markdown
 * saiu. É o que permite resolver as imagens citadas por caminho relativo.
 * `titulos`, quando houver, troca o caminho das referências pelo título.
 */
export async function renderMarkdown(
  markdown: string,
  caminhoDoDocumento = '',
  titulos?: Titulos,
): Promise<string> {
  if (!markdown.trim()) return '';
  const entrada = new VFile({ value: markdown });
  const contexto: Contexto = { pasta: pastaDe(caminhoDoDocumento), titulos };
  entrada.data = contexto as VFile['data'];
  const file = await processor.process(entrada);
  return String(file);
}

/** Texto puro de um trecho de markdown, para excerto e índice de busca. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`\[[^\]`]*\]`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, (row) => row.replace(/\|/g, ' '))
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*-{3,}\s*$/gm, ' ')
    .replace(/[*_>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
