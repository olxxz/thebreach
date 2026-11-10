/**
 * O que o site público mostra — CONVENCOES.md §1, "Quem vê o quê no site".
 *
 * `[PROPOSTA]` e `[LACUNA]` são do Ateliê: o build público não os publica.
 * O corte acontece aqui, no markdown bruto, antes de qualquer outra camada —
 * leitura, busca, galeria, relações, reinos, linha do tempo, Thalae — ver o
 * texto. Assim nada do Ateliê chega ao HTML estático, nem escondido.
 *
 * Isomórfico de propósito: o build usa para filtrar o acervo, e o navegador
 * usa no Ateliê para saber o que o público vê de cada documento.
 *
 * Regras:
 *  - `10-propostas/` é inteira do Ateliê; de `00-meta/` só saem as páginas
 *    públicas (convenções, índice, registro) e o cofre.
 *  - Num parágrafo, item, citação ou célula, o trecho que começa num marcador
 *    do Ateliê vai até o próximo marcador. Marcadores colados formam um grupo:
 *    `[PROPOSTA]` `[CRENÇA — x]` é uma crença proposta, e sai inteira.
 *  - Bloco que tinha marcadores e ficou sem nenhum sai inteiro.
 *  - Bloco sem marcador (imagem, lista, tabela, parágrafo solto) segue o bloco
 *    de antes na mesma seção: se aquele saiu, este sai junto. É a imagem da
 *    proposta, a lista que a proposta anunciou.
 *  - Seção de lacunas sai inteira; título que ficou sem conteúdo sai.
 *  - Referência a documento do Ateliê sai: "(ver `10-propostas/…`)" some, e o
 *    bloco que ainda cite a pasta sai.
 *  - Documento que tinha marcadores e ficou sem nenhum é todo do Ateliê.
 */

import { pastaDe } from './imagens';
import { resolverRelativo } from './slug';

export const PASTA_DO_ATELIE = '10-propostas/';

/** Os arquivos de `00-meta/` que o público vê. */
const META_PUBLICO = new Set([
  '00-meta/CONVENCOES.md',
  '00-meta/INDICE-CANONICO.md',
  '00-meta/REGISTRO-DE-ALTERACOES.md',
  '00-meta/COFRE.md',
]);

/** Marcadores que só o Ateliê vê, já sem acento. */
const DO_ATELIE = new Set(['PROPOSTA', 'LACUNA']);

const MARCADOR = /`\[\s*([^\]`]+?)\s*\]`/g;

function idDoMarcador(dentro: string): string {
  return dentro
    .split(/\s*[—–:-]\s*/)[0]
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

/** O caminho é do Ateliê por inteiro, sem nem precisar ler o texto? */
export function ehCaminhoDoAtelie(caminho: string): boolean {
  if (caminho.startsWith(PASTA_DO_ATELIE)) return true;
  if (caminho.startsWith('00-meta/') && caminho.endsWith('.md')) return !META_PUBLICO.has(caminho);
  return false;
}

interface Corte {
  /** O texto que sobra, ou `null` quando o trecho todo é do Ateliê. */
  texto: string | null;
  tinhaMarcador: boolean;
}

/**
 * Tira de um trecho de texto (uma linha de parágrafo, um item, uma célula) as
 * partes que começam num marcador do Ateliê.
 */
export function cortarTrecho(texto: string): Corte {
  const achados = [...texto.matchAll(MARCADOR)];
  if (achados.length === 0) return { texto, tinhaMarcador: false };

  // Agrupa marcadores colados (só espaço entre eles).
  const grupos: Array<{ inicio: number; fim: number; doAtelie: boolean }> = [];
  for (const achado of achados) {
    const inicio = achado.index as number;
    const fim = inicio + achado[0].length;
    const doAtelie = DO_ATELIE.has(idDoMarcador(achado[1]));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && texto.slice(ultimo.fim, inicio).trim() === '') {
      ultimo.fim = fim;
      ultimo.doAtelie ||= doAtelie;
    } else {
      grupos.push({ inicio, fim, doAtelie });
    }
  }

  let saida = texto.slice(0, grupos[0].inicio);
  let sobrouPublico = false;
  grupos.forEach((grupo, i) => {
    const fimDoTrecho = i + 1 < grupos.length ? grupos[i + 1].inicio : texto.length;
    if (grupo.doAtelie) return;
    sobrouPublico = true;
    saida += texto.slice(grupo.inicio, fimDoTrecho);
  });
  if (!sobrouPublico) return { texto: null, tinhaMarcador: true };
  return { texto: saida.replace(/[ \t]+$/g, ''), tinhaMarcador: true };
}

/** "(ver `10-propostas/x`)" e afins. */
const VER_ATELIE = /\s*\((?:ver|cf\.)[^()]*?10-propostas\/[^()]*\)/g;

function semReferenciasAoAtelie(texto: string): string {
  return texto.replace(VER_ATELIE, '');
}

/** Tira do campo "Documentos relacionados" os links para o Ateliê. */
function limparCampoDeLinks(linha: string): string {
  const m = /^(\*\*[^*]+:\*\*\s*)(.*)$/.exec(linha);
  if (!m) return linha;
  const itens = m[2].split(/,\s*(?=\[)/);
  const ficam = itens.filter((item) => !item.includes('10-propostas/'));
  if (ficam.length === itens.length) return linha;
  return m[1] + (ficam.length ? ficam.join(', ') : '—');
}

type Tipo = 'titulo' | 'regua' | 'cerca' | 'tabela' | 'lista' | 'citacao' | 'paragrafo' | 'imagem';

interface Bloco {
  tipo: Tipo;
  linhas: string[];
  nivel?: number;
  titulo?: string;
}

const EH_ITEM = /^(\s*)([-*+]|\d+[.)])\s+/;
const EH_IMAGEM_SO = /^\s*!\[[^\]]*\]\([^)]*\)\s*$/;

function dividirEmBlocos(markdown: string): Bloco[] {
  const linhas = markdown.split('\n');
  const blocos: Bloco[] = [];
  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];
    if (linha.trim() === '') {
      i += 1;
      continue;
    }
    if (/^\s*(```|~~~)/.test(linha)) {
      const cerca = linha.trim().slice(0, 3);
      const corpo = [linha];
      i += 1;
      while (i < linhas.length) {
        corpo.push(linhas[i]);
        if (linhas[i].trim().startsWith(cerca)) {
          i += 1;
          break;
        }
        i += 1;
      }
      blocos.push({ tipo: 'cerca', linhas: corpo });
      continue;
    }
    const titulo = /^(#{1,6})\s+(.*)$/.exec(linha);
    if (titulo) {
      blocos.push({ tipo: 'titulo', linhas: [linha], nivel: titulo[1].length, titulo: titulo[2].trim() });
      i += 1;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(linha)) {
      blocos.push({ tipo: 'regua', linhas: [linha] });
      i += 1;
      continue;
    }
    // Bloco comum: até a linha em branco, ou até um título, régua ou cerca.
    const corpo: string[] = [];
    while (
      i < linhas.length &&
      linhas[i].trim() !== '' &&
      !/^(#{1,6})\s/.test(linhas[i]) &&
      !/^\s*(```|~~~)/.test(linhas[i]) &&
      !(corpo.length > 0 && /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(linhas[i]))
    ) {
      corpo.push(linhas[i]);
      i += 1;
    }
    const primeira = corpo[0];
    const tipo: Tipo = /^\s*\|/.test(primeira)
      ? 'tabela'
      : EH_ITEM.test(primeira)
        ? 'lista'
        : /^\s*>/.test(primeira)
          ? 'citacao'
          : corpo.every((l) => EH_IMAGEM_SO.test(l))
            ? 'imagem'
            : 'paragrafo';
    blocos.push({ tipo, linhas: corpo });
  }
  return blocos;
}

/** Itens de uma lista, cada um com as linhas de continuação. */
function itensDaLista(linhas: string[]): string[][] {
  const itens: string[][] = [];
  for (const linha of linhas) {
    if (EH_ITEM.test(linha) || itens.length === 0) itens.push([linha]);
    else itens[itens.length - 1].push(linha);
  }
  return itens;
}

/** Resultado de um bloco depois do corte: as linhas que ficam, ou `null`. */
interface Filtrado {
  linhas: string[] | null;
  tinhaMarcador: boolean;
}

function filtrarTexto(linhas: string[]): Filtrado {
  const texto = semReferenciasAoAtelie(linhas.join('\n'));
  const corte = cortarTrecho(texto);
  if (corte.texto === null) return { linhas: null, tinhaMarcador: true };
  if (corte.texto.includes('10-propostas/')) return { linhas: null, tinhaMarcador: corte.tinhaMarcador };
  const limpo = corte.texto.replace(/\s+$/, '');
  if (!limpo.trim()) return { linhas: null, tinhaMarcador: corte.tinhaMarcador };
  return { linhas: limpo.split('\n'), tinhaMarcador: corte.tinhaMarcador };
}

function filtrarLista(linhas: string[]): Filtrado {
  let tinhaMarcador = false;
  const ficam: string[] = [];
  for (const item of itensDaLista(linhas)) {
    const r = filtrarTexto(item);
    tinhaMarcador ||= r.tinhaMarcador;
    if (r.linhas) ficam.push(...r.linhas);
  }
  return { linhas: ficam.length ? ficam : null, tinhaMarcador };
}

function filtrarTabela(linhas: string[]): Filtrado {
  if (linhas.length < 2) return filtrarTexto(linhas);
  const [cabeca, regua, ...corpo] = linhas;
  let tinhaMarcador = false;
  const ficam: string[] = [];
  for (const linha of corpo) {
    const limpa = semReferenciasAoAtelie(linha);
    if (limpa.includes('10-propostas/')) continue;
    const celulas = limpa.split('|');
    let algumaPublica = false;
    let algumaMarcada = false;
    // As pontas de `| a | b |` viram células vazias no split: não contam.
    const semMarca = celulas.slice(1, -1).filter((c) => c.trim() && !cortarTrecho(c).tinhaMarcador).length;
    const novas = celulas.map((celula) => {
      const r = cortarTrecho(celula);
      if (!r.tinhaMarcador) return celula;
      algumaMarcada = true;
      if (r.texto === null) return ' ';
      algumaPublica = true;
      return r.texto.endsWith(' ') ? r.texto : `${r.texto} `;
    });
    tinhaMarcador ||= algumaMarcada;
    // Linha cujas marcas eram todas do Ateliê sai — a não ser que ainda diga
    // algo sem elas (rótulo e mais uma célula): aí fica, com a célula vazia.
    if (algumaMarcada && !algumaPublica && semMarca < 2) continue;
    ficam.push(novas.join('|'));
  }
  if (corpo.length > 0 && ficam.length === 0) return { linhas: null, tinhaMarcador };
  return { linhas: [cabeca, regua, ...ficam], tinhaMarcador };
}

export interface VersaoPublica {
  /** O markdown que o público lê. */
  texto: string;
  /** `true` quando nada do documento é público — ele sai do site. */
  doAtelie: boolean;
}

const SECAO_DO_ATELIE = /^(\d+(\.\d+)*\.?\s*)?(lacunas\b.*|propostas)$/i;

/** A versão pública de um documento do acervo. */
export function paraPublico(markdown: string, caminho: string): VersaoPublica {
  if (ehCaminhoDoAtelie(caminho)) return { texto: '', doAtelie: true };

  const blocos = dividirEmBlocos(markdown.replace(/\r\n/g, '\n'));
  const saida: Array<Bloco | null> = [];
  let tinhaMarcador = false;
  let sobrouMarcador = false;
  let anteriorSaiu = false;
  /** Nível do título de uma seção do Ateliê em curso, ou 0. */
  let pulandoAte = 0;

  for (const bloco of blocos) {
    if (bloco.tipo === 'titulo') {
      const nivel = bloco.nivel as number;
      if (pulandoAte && nivel > pulandoAte) {
        saida.push(null);
        continue;
      }
      pulandoAte = 0;
      anteriorSaiu = false;
      const soMarcador = /^`\[\s*([^\]`]+?)\s*\]`$/.exec((bloco.titulo as string).trim());
      if (soMarcador && DO_ATELIE.has(idDoMarcador(soMarcador[1]))) {
        // `#### [LACUNA]` — o título é o marcador: a seção inteira é do Ateliê.
        tinhaMarcador = true;
        pulandoAte = nivel;
        saida.push(null);
        continue;
      }
      if (soMarcador) tinhaMarcador = sobrouMarcador = true;
      if (nivel >= 2 && SECAO_DO_ATELIE.test(bloco.titulo as string)) {
        pulandoAte = nivel;
        saida.push(null);
        continue;
      }
      saida.push(bloco);
      continue;
    }
    if (pulandoAte) {
      // Contar os marcadores mesmo assim: uma seção de lacunas não torna o
      // documento público.
      if (bloco.tipo !== 'cerca' && MARCADOR.test(bloco.linhas.join('\n'))) tinhaMarcador = true;
      MARCADOR.lastIndex = 0;
      saida.push(null);
      continue;
    }
    if (bloco.tipo === 'regua' || bloco.tipo === 'cerca') {
      saida.push(bloco);
      continue;
    }

    const linhas = bloco.linhas.map((l) => (/^\*\*Documentos (relacionados|derivados):\*\*/.test(l) ? limparCampoDeLinks(l) : l));
    const r =
      bloco.tipo === 'lista'
        ? filtrarLista(linhas)
        : bloco.tipo === 'tabela'
          ? filtrarTabela(linhas)
          : filtrarTexto(linhas);

    if (!r.tinhaMarcador && anteriorSaiu) {
      // Sem marcador próprio: segue o bloco de antes.
      saida.push(null);
      continue;
    }
    tinhaMarcador ||= r.tinhaMarcador;
    if (!r.linhas) {
      anteriorSaiu = true;
      saida.push(null);
      continue;
    }
    if (r.tinhaMarcador) {
      sobrouMarcador ||= MARCADOR.test(r.linhas.join('\n'));
      MARCADOR.lastIndex = 0;
    }
    anteriorSaiu = false;
    saida.push({ ...bloco, linhas: r.linhas });
  }

  // Títulos sem conteúdo até o próximo título de mesmo nível ou acima.
  const ficam = saida.filter((b): b is Bloco => b !== null);
  const limpos: Bloco[] = [];
  for (let i = ficam.length - 1; i >= 0; i -= 1) {
    const bloco = ficam[i];
    if (bloco.tipo === 'titulo' && (bloco.nivel as number) >= 2) {
      const temConteudo = limpos.some((depois, j) => {
        // Só até o próximo título de mesmo nível ou acima.
        const corte = limpos.findIndex((b) => b.tipo === 'titulo' && (b.nivel as number) <= (bloco.nivel as number));
        if (corte !== -1 && j >= corte) return false;
        return depois.tipo !== 'regua' && depois.tipo !== 'titulo';
      });
      if (!temConteudo) continue;
    }
    limpos.unshift(bloco);
  }

  // Réguas repetidas ou no fim.
  const final: Bloco[] = [];
  for (const bloco of limpos) {
    if (bloco.tipo === 'regua' && (final.length === 0 || final[final.length - 1].tipo === 'regua')) continue;
    final.push(bloco);
  }
  while (final.length && final[final.length - 1].tipo === 'regua') final.pop();

  const texto = `${final.map((b) => b.linhas.join('\n')).join('\n\n')}\n`;
  return { texto, doAtelie: tinhaMarcador && !sobrouMarcador };
}

/** Imagens e áudios citados por um markdown, como caminhos do acervo. */
export function midiaCitada(markdown: string, caminhoDoDocumento: string): string[] {
  const pasta = pastaDe(caminhoDoDocumento);
  const achados = new Set<string>();
  for (const [, alvo] of markdown.matchAll(/\]\(\s*<?([^)>\s]+)>?[^)]*\)/g)) {
    if (/^(https?:|data:|#)/i.test(alvo)) continue;
    if (!/\.(png|webp|jpe?g|avif|svg|mp3|ogg)$/i.test(alvo)) continue;
    achados.add(alvo.startsWith('/') ? alvo.slice(1) : resolverRelativo(pasta, alvo));
  }
  return [...achados];
}
