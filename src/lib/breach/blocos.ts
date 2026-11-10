/**
 * O documento em blocos, para o editor visual.
 *
 * Duas garantias sustentam o editor:
 *
 *  1. **Sem perda.** `juntar(partir(texto)) === texto`, sempre. Cada bloco
 *     guarda o markdown exato de onde veio e as linhas em branco que o seguem.
 *     Bloco em que ninguém mexeu volta ao acervo byte a byte igual — o diff de
 *     uma edição tem o tamanho da edição.
 *  2. **Só edita rico o que sabe reescrever.** Um bloco só ganha edição visual
 *     se o markdown gerado a partir da leitura dele for idêntico ao original
 *     (`podeSerRico`). O que não passa nesse teste é editado como markdown, no
 *     próprio lugar, e nada se estraga em silêncio.
 */

import { MARKERS, parseMarkerToken } from './markers';
import { labelFromPath, looksLikeDocPath } from './slug';

export type TipoDeBloco =
  | 'titulo'
  | 'paragrafo'
  | 'lista'
  | 'tabela'
  | 'citacao'
  | 'imagem'
  | 'regua'
  | 'codigo'
  /** Linha `**Campo:** valor` do cabeçalho: quem edita é o formulário. */
  | 'campo';

export interface Bloco {
  id: string;
  tipo: TipoDeBloco;
  /** O markdown do bloco, sem as quebras que o separam do seguinte. */
  raw: string;
  /** As quebras de linha depois do bloco. */
  sep: string;
}

let contador = 0;
export function novoId(): string {
  contador += 1;
  return `b${contador}`;
}

const CERCA = /^ {0,3}(`{3,}|~{3,})/;
const TITULO = /^#{1,6}\s/;
const REGUA = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const IMAGEM_SO = /^!\[([^\]]*)\]\(\s*<?([^)>\s]+)>?\s*\)$/;
const CAMPO = /^\*\*.+?:\*\*/;

/** Parte o markdown em blocos. O inverso exato é `juntar`. */
export function partir(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  type Aberto = { tipo: TipoDeBloco; linhas: string[] };
  let atual = null as Aberto | null;
  let cerca: string | null = null;

  const fechar = (): void => {
    if (!atual) return;
    blocos.push({ id: novoId(), tipo: atual.tipo, raw: atual.linhas.join('\n'), sep: '\n' });
    atual = null;
  };
  const abrir = (tipo: TipoDeBloco, linha: string): void => {
    fechar();
    atual = { tipo, linhas: [linha] };
  };

  for (const linha of texto.split('\n')) {
    if (cerca !== null && atual) {
      (atual as Aberto).linhas.push(linha);
      if (linha.trim().startsWith(cerca) && linha.trim().replace(/[`~]/g, '') === '') {
        cerca = null;
        fechar();
      }
      continue;
    }

    if (linha.trim() === '') {
      fechar();
      if (blocos.length === 0) blocos.push({ id: novoId(), tipo: 'paragrafo', raw: '', sep: '' });
      blocos[blocos.length - 1].sep += '\n';
      continue;
    }

    const abreCerca = CERCA.exec(linha);
    if (abreCerca) {
      abrir('codigo', linha);
      cerca = abreCerca[1];
      continue;
    }
    if (TITULO.test(linha)) {
      abrir('titulo', linha);
      fechar();
      continue;
    }
    const corrente = atual as Aberto | null;
    if (REGUA.test(linha) && corrente?.tipo !== 'paragrafo') {
      abrir('regua', linha);
      fechar();
      continue;
    }
    if (/^\s*\|/.test(linha)) {
      if (corrente?.tipo === 'tabela') corrente.linhas.push(linha);
      else abrir('tabela', linha);
      continue;
    }
    if (/^\s*>/.test(linha)) {
      if (corrente?.tipo === 'citacao') corrente.linhas.push(linha);
      else abrir('citacao', linha);
      continue;
    }
    if (ITEM.test(linha)) {
      if (corrente?.tipo === 'lista') corrente.linhas.push(linha);
      else abrir('lista', linha);
      continue;
    }
    // Linha comum: continua o que estiver aberto, ou abre um parágrafo.
    if (corrente && ['paragrafo', 'lista', 'citacao'].includes(corrente.tipo)) corrente.linhas.push(linha);
    else abrir('paragrafo', linha);
  }
  fechar();

  // Cada linha foi contada com a quebra dela; a última do texto não tem uma.
  const ultimo = blocos[blocos.length - 1];
  if (ultimo) ultimo.sep = ultimo.sep.slice(0, -1);

  // O que é cabeçalho e o que é figura só se sabe olhando o bloco inteiro.
  let noPreambulo = true;
  for (const bloco of blocos) {
    if (bloco.tipo === 'titulo' && /^#{2,}\s/.test(bloco.raw)) noPreambulo = false;
    if (bloco.tipo !== 'paragrafo') continue;
    if (IMAGEM_SO.test(bloco.raw.trim())) bloco.tipo = 'imagem';
    else if (noPreambulo && bloco.raw.split('\n').every((linha) => CAMPO.test(linha.trim()))) bloco.tipo = 'campo';
  }
  return blocos;
}

export function juntar(blocos: Bloco[]): string {
  return blocos.map((bloco) => bloco.raw + bloco.sep).join('');
}

/* --- Texto corrido ---------------------------------------------------------- */

export type No =
  | { t: 'texto'; v: string }
  /** Trecho entre crases, com as crases: marcador, referência ou código. */
  | { t: 'codigo'; raw: string }
  | { t: 'forte'; m: string; f: No[] }
  | { t: 'enfase'; m: string; f: No[] }
  | { t: 'link'; f: No[]; href: string }
  | { t: 'imagem'; raw: string };

/** Acha o fecho de um par de colchetes, pulando trechos entre crases. */
function fechoDoColchete(s: string, de: number): number {
  let fundo = 0;
  for (let i = de; i < s.length; i += 1) {
    const c = s[i];
    if (c === '\\') {
      i += 1;
    } else if (c === '`') {
      const fim = s.indexOf('`', i + 1);
      if (fim === -1) return -1;
      i = fim;
    } else if (c === '[') {
      fundo += 1;
    } else if (c === ']') {
      fundo -= 1;
      if (fundo === 0) return i;
    }
  }
  return -1;
}

/** Onde fecha um delimitador de ênfase aberto em `de`. `-1` se não fecha. */
function fechoDaEnfase(s: string, de: number, marca: string): number {
  for (let i = de; i < s.length; i += 1) {
    const c = s[i];
    if (c === '\\') {
      i += 1;
      continue;
    }
    if (c === '`') {
      const fim = s.indexOf('`', i + 1);
      if (fim === -1) return -1;
      i = fim;
      continue;
    }
    if (!s.startsWith(marca, i)) continue;
    // Um `*` solto dentro de `**…**` não fecha o negrito, e vice-versa.
    if (marca.length === 1 && (s[i + 1] === marca || s[i - 1] === marca)) {
      if (s[i + 1] === marca) i += 1;
      continue;
    }
    if (i === de || /\s/.test(s[i - 1])) continue;
    if (marca === '_' && /[\p{L}\p{N}]/u.test(s[i + 1] ?? '')) continue;
    return i;
  }
  return -1;
}

export function lerCorrido(s: string): No[] {
  const nos: No[] = [];
  let texto = '';
  const soltar = (): void => {
    if (texto) nos.push({ t: 'texto', v: texto });
    texto = '';
  };

  let i = 0;
  while (i < s.length) {
    const c = s[i];

    if (c === '\\' && i + 1 < s.length) {
      texto += s.slice(i, i + 2);
      i += 2;
      continue;
    }

    if (c === '`') {
      const abre = /^`+/.exec(s.slice(i))?.[0] ?? '`';
      const fim = s.indexOf(abre, i + abre.length);
      if (fim !== -1 && s[fim + abre.length] !== '`') {
        soltar();
        nos.push({ t: 'codigo', raw: s.slice(i, fim + abre.length) });
        i = fim + abre.length;
        continue;
      }
    }

    if (c === '!' && s[i + 1] === '[') {
      const imagem = /^!\[[^\]]*\]\([^)]*\)/.exec(s.slice(i));
      if (imagem) {
        soltar();
        nos.push({ t: 'imagem', raw: imagem[0] });
        i += imagem[0].length;
        continue;
      }
    }

    if (c === '[') {
      const fecho = fechoDoColchete(s, i);
      if (fecho !== -1 && s[fecho + 1] === '(') {
        const fim = s.indexOf(')', fecho + 2);
        if (fim !== -1) {
          soltar();
          nos.push({ t: 'link', f: lerCorrido(s.slice(i + 1, fecho)), href: s.slice(fecho + 2, fim) });
          i = fim + 1;
          continue;
        }
      }
    }

    if (c === '*' || c === '_') {
      const marca = s.startsWith(c + c, i) ? c + c : c;
      const depois = s[i + marca.length];
      const antes = s[i - 1] ?? ' ';
      const podeAbrir =
        depois !== undefined && !/\s/.test(depois) && (c === '*' || !/[\p{L}\p{N}]/u.test(antes));
      if (podeAbrir) {
        const fim = fechoDaEnfase(s, i + marca.length, marca);
        if (fim !== -1) {
          soltar();
          const dentro = lerCorrido(s.slice(i + marca.length, fim));
          nos.push(marca.length === 2 ? { t: 'forte', m: marca, f: dentro } : { t: 'enfase', m: marca, f: dentro });
          i = fim + marca.length;
          continue;
        }
      }
    }

    texto += c;
    i += 1;
  }
  soltar();
  return nos;
}

export function corridoParaMd(nos: No[]): string {
  return nos
    .map((no) => {
      switch (no.t) {
        case 'texto':
          return no.v;
        case 'codigo':
        case 'imagem':
          return no.raw;
        case 'forte':
        case 'enfase':
          return `${no.m}${corridoParaMd(no.f)}${no.m}`;
        case 'link':
          return `[${corridoParaMd(no.f)}](${no.href})`;
      }
    })
    .join('');
}

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Uma peça que não se edita letra a letra: marcador, referência, imagem. O
 * markdown exato viaja em `data-md`, e é ele que volta ao texto.
 */
function peca(classe: string, md: string, dentro: string, titulo = ''): string {
  return `<span class="${classe}" contenteditable="false" data-md="${escapar(md)}"${
    titulo ? ` title="${escapar(titulo)}"` : ''
  }>${dentro}</span>`;
}

/** O HTML de um trecho entre crases: selo, referência a documento, ou código. */
export function htmlDoCodigo(raw: string): string {
  const dentro = raw.replace(/^`+|`+$/g, '');
  const marcador = dentro.trim().startsWith('[') ? parseMarkerToken(dentro.trim()) : null;
  if (marcador) {
    return peca(
      `marker marker--${marcador.id.toLowerCase()} ed-peca`,
      raw,
      `<span class="marker__label">${escapar(marcador.label)}</span>${
        marcador.source ? `<span class="marker__source">${escapar(marcador.source)}</span>` : ''
      }`,
      MARKERS[marcador.id].meaning,
    );
  }
  if (looksLikeDocPath(dentro)) {
    return peca('ed-ref ed-peca', raw, escapar(labelFromPath(dentro)), dentro);
  }
  return `<code>${escapar(dentro)}</code>`;
}

export function corridoParaHtml(nos: No[]): string {
  return nos
    .map((no) => {
      switch (no.t) {
        case 'texto':
          return escapar(no.v);
        case 'codigo':
          return htmlDoCodigo(no.raw);
        case 'imagem':
          return peca('ed-ref ed-peca', no.raw, 'imagem', no.raw);
        case 'forte':
          return `<strong>${corridoParaHtml(no.f)}</strong>`;
        case 'enfase':
          return `<em>${corridoParaHtml(no.f)}</em>`;
        case 'link':
          return `<a href="#" data-href="${escapar(no.href)}" title="${escapar(no.href)}">${corridoParaHtml(no.f)}</a>`;
      }
    })
    .join('');
}

/**
 * O espaço do fim vira espaço duro: o HTML engole o espaço final de um bloco,
 * e o cursor posto depois de um marcador recém-criado colaria no selo.
 */
export const mdParaHtml = (md: string): string => corridoParaHtml(lerCorrido(md)).replace(/ $/, '&nbsp;');

/** O texto corrido volta idêntico depois de lido? Então pode ser editado rico. */
function corridoFiel(md: string): boolean {
  return corridoParaMd(lerCorrido(md)) === md;
}

/* --- Do DOM de volta ao markdown ------------------------------------------- */

/** Tira os espaços das pontas de dentro da ênfase: `**a **` não é negrito. */
function envolver(marca: string, dentro: string): string {
  const nucleo = dentro.trim();
  if (!nucleo) return dentro;
  const antes = dentro.slice(0, dentro.length - dentro.trimStart().length);
  const depois = dentro.slice(dentro.trimEnd().length);
  return `${antes}${marca}${nucleo}${marca}${depois}`;
}

/** Lê o conteúdo de um elemento editável como markdown corrido. */
export function domParaMd(raiz: Node, pular?: (el: Element) => boolean): string {
  let saida = '';
  raiz.childNodes.forEach((filho) => {
    if (filho.nodeType === 3) {
      saida += (filho.nodeValue ?? '').replace(/ /g, ' ').replace(/​/g, '');
      return;
    }
    if (filho.nodeType !== 1) return;
    const el = filho as HTMLElement;
    if (pular?.(el)) return;
    if (el.dataset.md !== undefined) {
      saida += el.dataset.md;
      return;
    }
    const dentro = (): string => domParaMd(el, pular);
    switch (el.tagName) {
      case 'STRONG':
      case 'B':
        saida += envolver('**', dentro());
        break;
      case 'EM':
      case 'I':
        saida += envolver('*', dentro());
        break;
      case 'CODE':
        saida += `\`${el.textContent ?? ''}\``;
        break;
      case 'A':
        saida += `[${dentro()}](${el.dataset.href ?? el.getAttribute('href') ?? ''})`;
        break;
      case 'BR':
        // O navegador espalha `<br>` por conta própria em bloco editável; a
        // quebra de linha do acervo é sempre um bloco novo, nunca esta.
        break;
      case 'DIV':
      case 'P':
        // Embrulho que o navegador cria sozinho: o texto segue na mesma linha.
        saida += dentro();
        break;
      default:
        saida += dentro();
    }
  });
  return saida;
}

/* --- Título ------------------------------------------------------------------ */

export function lerTitulo(raw: string): { nivel: number; texto: string } {
  const m = /^(#{1,6})\s+(.*)$/.exec(raw) ?? ['', '#', raw];
  return { nivel: m[1].length, texto: m[2] };
}

/* --- Lista ------------------------------------------------------------------- */

export interface ItemDeLista {
  texto: string;
  filhos: Lista | null;
}

export interface Lista {
  ordenada: boolean;
  /** O sinal dos itens: `-`, `*`, `+`; nas ordenadas, o fecho: `.` ou `)`. */
  sinal: string;
  itens: ItemDeLista[];
}

export function lerLista(raw: string): Lista | null {
  const linhas = raw.split('\n').map((linha) => ITEM.exec(linha));
  if (linhas.some((m) => m === null)) return null;
  const itens = linhas as RegExpExecArray[];

  const montar = (de: number, recuo: number): { lista: Lista; ate: number } => {
    const primeiro = itens[de];
    const ordenada = /\d/.test(primeiro[2]);
    const lista: Lista = { ordenada, sinal: ordenada ? primeiro[2].slice(-1) : primeiro[2], itens: [] };
    let i = de;
    while (i < itens.length) {
      const r = itens[i][1].length;
      if (r < recuo) break;
      if (r > recuo) {
        const { lista: filha, ate } = montar(i, r);
        const dono = lista.itens[lista.itens.length - 1];
        if (dono) dono.filhos = filha;
        i = ate;
        continue;
      }
      lista.itens.push({ texto: itens[i][3], filhos: null });
      i += 1;
    }
    return { lista, ate: i };
  };

  return montar(0, itens[0][1].length).lista;
}

export function listaParaMd(lista: Lista, recuo = ''): string {
  const linhas: string[] = [];
  lista.itens.forEach((item, i) => {
    const sinal = lista.ordenada ? `${i + 1}${lista.sinal}` : lista.sinal;
    linhas.push(`${recuo}${sinal} ${item.texto}`);
    if (item.filhos) linhas.push(listaParaMd(item.filhos, `${recuo}${' '.repeat(sinal.length + 1)}`));
  });
  return linhas.join('\n');
}

export function listaParaHtml(lista: Lista): string {
  const tag = lista.ordenada ? 'ol' : 'ul';
  const itens = lista.itens
    .map((item) => `<li>${mdParaHtml(item.texto)}${item.filhos ? listaParaHtml(item.filhos) : ''}</li>`)
    .join('');
  return `<${tag} data-sinal="${escapar(lista.sinal)}">${itens}</${tag}>`;
}

/** Lê a lista de volta do DOM editado. */
export function domParaLista(el: Element): Lista {
  const ordenada = el.tagName === 'OL';
  const ehLista = (no: Element): boolean => no.tagName === 'UL' || no.tagName === 'OL';
  const itens: ItemDeLista[] = [];
  for (const li of Array.from(el.children)) {
    if (li.tagName !== 'LI') continue;
    const filha = Array.from(li.children).find(ehLista);
    itens.push({
      texto: domParaMd(li, ehLista).replace(/\n+/g, ' ').trim(),
      filhos: filha ? domParaLista(filha) : null,
    });
  }
  return { ordenada, sinal: (el as HTMLElement).dataset.sinal || (ordenada ? '.' : '-'), itens };
}

/* --- Tabela ------------------------------------------------------------------ */

export interface Tabela {
  cabeca: string[];
  /** A linha de alinhamento como está no acervo: `---`, `:---:`… */
  alinhamento: string[];
  linhas: string[][];
}

/** Divide uma linha de tabela nas células, sem cortar barra entre crases. */
function celulas(linha: string): string[] {
  const limpa = linha.trim().replace(/^\|/, '').replace(/\|\s*$/, '');
  const saida: string[] = [];
  let atual = '';
  let emCrase = false;
  for (let i = 0; i < limpa.length; i += 1) {
    const c = limpa[i];
    if (c === '\\' && limpa[i + 1] === '|') {
      atual += '\\|';
      i += 1;
    } else if (c === '`') {
      emCrase = !emCrase;
      atual += c;
    } else if (c === '|' && !emCrase) {
      saida.push(atual.trim());
      atual = '';
    } else {
      atual += c;
    }
  }
  saida.push(atual.trim());
  return saida;
}

export function lerTabela(raw: string): Tabela | null {
  const linhas = raw.split('\n');
  if (linhas.length < 2) return null;
  const cabeca = celulas(linhas[0]);
  const alinhamento = celulas(linhas[1]);
  if (!alinhamento.every((c) => /^:?-+:?$/.test(c)) || alinhamento.length !== cabeca.length) return null;
  const corpo = linhas.slice(2).map(celulas);
  if (corpo.some((linha) => linha.length !== cabeca.length)) return null;
  return { cabeca, alinhamento, linhas: corpo };
}

export function tabelaParaMd(tabela: Tabela): string {
  const linha = (cels: string[]): string => `| ${cels.join(' | ')} |`;
  return [
    linha(tabela.cabeca),
    `|${tabela.alinhamento.join('|')}|`,
    ...tabela.linhas.map(linha),
  ].join('\n');
}

/* --- Citação ----------------------------------------------------------------- */

export function lerCitacao(raw: string): string | null {
  const linhas = raw.split('\n');
  if (linhas.length !== 1 || !/^> /.test(linhas[0])) return null;
  return linhas[0].slice(2);
}

/* --- Imagem ------------------------------------------------------------------ */

export function lerImagem(raw: string): { alt: string; src: string } | null {
  const m = IMAGEM_SO.exec(raw.trim());
  return m ? { alt: m[1], src: m[2] } : null;
}

/* --- Pode ser editado rico? -------------------------------------------------- */

export function podeSerRico(bloco: Bloco): boolean {
  switch (bloco.tipo) {
    case 'paragrafo':
      return corridoFiel(bloco.raw);
    case 'titulo':
      return /^#{1,6} /.test(bloco.raw) && corridoFiel(lerTitulo(bloco.raw).texto);
    case 'lista': {
      const lista = lerLista(bloco.raw);
      if (!lista || listaParaMd(lista) !== bloco.raw) return false;
      const fiel = (l: Lista): boolean =>
        l.itens.every((item) => corridoFiel(item.texto) && (!item.filhos || fiel(item.filhos)));
      return fiel(lista);
    }
    case 'tabela': {
      const tabela = lerTabela(bloco.raw);
      return Boolean(tabela) && [...(tabela as Tabela).cabeca, ...(tabela as Tabela).linhas.flat()].every(corridoFiel);
    }
    case 'citacao': {
      const dentro = lerCitacao(bloco.raw);
      return dentro !== null && corridoFiel(dentro);
    }
    case 'imagem':
      return lerImagem(bloco.raw) !== null && `![${lerImagem(bloco.raw)?.alt}](${lerImagem(bloco.raw)?.src})` === bloco.raw.trim();
    case 'regua':
      return true;
    default:
      return false;
  }
}

/** Um bloco novo, pronto para entrar no documento. */
export function criarBloco(tipo: TipoDeBloco, raw: string): Bloco {
  return { id: novoId(), tipo, raw, sep: '\n\n' };
}
