/**
 * O diário do editor.
 *
 * Toda gravação feita pelo site deixa uma entrada em `00-meta/DIARIO-DO-EDITOR.md`,
 * no mesmo commit: o que mudou, em que seções, que marcadores e referências
 * entraram ou saíram, e o que ficou por conferir em volta — índice canônico,
 * registro de alterações, documentos vizinhos. Quem faz a passagem seguinte
 * pelo acervo lê o diário, completa o que falta e apaga as entradas conferidas.
 *
 * Os caminhos são escritos sem crases de propósito: entre crases eles seriam
 * referências, e a conferência do acervo cobraria a existência de um arquivo
 * que a própria entrada pode estar dizendo que saiu do lugar.
 */

import { diffLines } from 'diff';
import { lerArquivo, type Mudanca } from './github';
import { MARKERS, tallyMarkers } from './markers';
import { lerCampos, CAMPOS } from './cabecalho';
import type { MarkerId } from './types';

export const CAMINHO_DIARIO = '00-meta/DIARIO-DO-EDITOR.md';

const MARCA = '<!-- entradas: a mais recente em cima -->';

const CABECA = `# Diário do editor

Registro automático do que foi gravado pelo editor do site. Cada entrada diz o que mudou e o que ficou por conferir em volta.

**Como usar:** antes de qualquer passagem de trabalho, ler este arquivo. Para cada entrada: conferir o índice canônico, o registro de alterações, as referências cruzadas dos documentos vizinhos e as datas; completar o que faltar; apagar a entrada conferida.

---

${MARCA}
`;

export interface Contexto {
  acao: 'edição' | 'criação' | 'mudança de caminho';
  /** O documento de que a gravação trata. */
  principal: string;
  /** O texto do documento antes da gravação, quando ele já existia. */
  antes?: string;
  /** Para onde o documento foi, numa mudança de caminho. */
  destino?: string;
  /** O que o Criador deixou anotado para a revisão. */
  nota?: string;
}

const DIFF_MAXIMO = 60;

function agora(): string {
  const d = new Date();
  const dois = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** Referências a documentos num texto: links relativos e caminhos entre crases. */
function referencias(texto: string): Set<string> {
  const achadas = new Set<string>();
  for (const [, alvo] of texto.matchAll(/(?<!!)\[[^\]]*\]\(\s*<?([^)>\s]+)>?[^)]*\)/g)) {
    if (!/^[a-z][a-z0-9+.-]*:/i.test(alvo) && !/\.(mp3|ogg)$/i.test(alvo)) achadas.add(alvo);
  }
  for (const [, crase] of texto.matchAll(/`(\d{2}-[a-z-]+\/[^`\n]*)`/gi)) achadas.add(crase);
  return achadas;
}

function compararTextos(antes: string, depois: string): string[] {
  const linhas: string[] = [];

  // Seções tocadas e o diff resumido saem da mesma passada.
  const secoes = new Set<string>();
  const diff: string[] = [];
  let secao = '(abertura)';
  for (const parte of diffLines(antes, depois)) {
    const trecho = parte.value.replace(/\n$/, '').split('\n');
    for (const linha of trecho) {
      const titulo = /^#{2,3}\s+(.*)$/.exec(linha);
      if (titulo && !parte.removed) secao = titulo[1].trim();
      if (parte.added || parte.removed) {
        secoes.add(secao);
        if (linha.trim()) diff.push(`${parte.added ? '+' : '-'} ${linha}`);
      }
    }
  }
  if (secoes.size) linhas.push(`- **Seções tocadas:** ${[...secoes].join('; ')}`);

  const [ma, md] = [tallyMarkers(antes), tallyMarkers(depois)];
  const marcadores = (Object.keys(MARKERS) as MarkerId[])
    .map((id) => ({ id, delta: (md[id] ?? 0) - (ma[id] ?? 0) }))
    .filter((m) => m.delta !== 0)
    .map((m) => `${MARKERS[m.id].label} ${m.delta > 0 ? '+' : '−'}${Math.abs(m.delta)}`);
  if (marcadores.length) linhas.push(`- **Marcadores:** ${marcadores.join(', ')}`);

  const [ra, rd] = [referencias(antes), referencias(depois)];
  const novas = [...rd].filter((r) => !ra.has(r));
  const saidas = [...ra].filter((r) => !rd.has(r));
  if (novas.length) linhas.push(`- **Referências novas:** ${novas.join(', ')}`);
  if (saidas.length) linhas.push(`- **Referências retiradas:** ${saidas.join(', ')}`);

  const [ca, cd] = [lerCampos(antes), lerCampos(depois)];
  const campos = CAMPOS.filter((c) => c !== 'Última atualização' && c !== 'Documentos relacionados' && ca[c] !== cd[c])
    .map((c) => `${c}: ${ca[c] ?? '(sem)'} → ${cd[c] ?? '(sem)'}`);
  if (campos.length) linhas.push(`- **Cabeçalho:** ${campos.join('; ')}`);

  if (diff.length) {
    const corte = diff.slice(0, DIFF_MAXIMO);
    linhas.push('', '```diff', ...corte);
    if (diff.length > DIFF_MAXIMO) linhas.push(`… mais ${diff.length - DIFF_MAXIMO} linhas`);
    linhas.push('```');
  }
  return linhas;
}

/** A entrada de uma gravação, em markdown. */
export function entradaDoDiario(mudancas: Mudanca[], mensagem: string, contexto: Contexto): string {
  const linhas = [`## ${agora()} — ${contexto.acao} — ${contexto.principal}`, '', `- **Mensagem:** ${mensagem}`];
  if (contexto.destino && contexto.destino !== contexto.principal) {
    linhas.push(`- **Passou a ser:** ${contexto.destino}`);
  }

  const outros = mudancas.filter((m) => m.path !== contexto.principal && m.path !== contexto.destino);
  const lista = (tipo: (m: Mudanca) => boolean): string => outros.filter(tipo).map((m) => m.path).join(', ');
  const imagens = lista((m) => m.tipo === 'binario');
  const textos = lista((m) => m.tipo === 'texto');
  const movidos = lista((m) => m.tipo === 'blob');
  const removidos = lista((m) => m.tipo === 'remover');
  if (imagens) linhas.push(`- **Imagens enviadas:** ${imagens}`);
  if (textos) linhas.push(`- **Outros documentos reescritos:** ${textos}`);
  if (movidos) linhas.push(`- **Arquivos movidos:** ${movidos}`);
  if (removidos) linhas.push(`- **Caminhos que deixaram de existir:** ${removidos}`);

  const principal = mudancas.find(
    (m) => m.tipo === 'texto' && (m.path === contexto.principal || m.path === contexto.destino),
  );
  let detalhe: string[] = [];
  if (principal?.tipo === 'texto' && contexto.antes !== undefined) {
    detalhe = compararTextos(contexto.antes, principal.conteudo);
  }
  const corpo = detalhe.findIndex((l) => l === '');
  linhas.push(...(corpo === -1 ? detalhe : detalhe.slice(0, corpo)));

  if (contexto.nota?.trim()) linhas.push(`- **Nota do Criador:** ${contexto.nota.trim()}`);

  const conferir = ['registro de alterações', 'índice canônico (fato central e status)'];
  if (contexto.acao !== 'edição') conferir.push('índice da categoria', 'linha do tempo');
  conferir.push('documentos relacionados dos vizinhos');
  linhas.push(`- **A conferir:** ${conferir.join(' · ')}`);

  if (corpo !== -1) linhas.push(...detalhe.slice(corpo));
  return `${linhas.join('\n')}\n`;
}

/**
 * Acrescenta a entrada do diário às mudanças de um commit. Se o diário não
 * puder ser lido, a gravação segue sem ele: perder a anotação é melhor do que
 * perder o texto.
 */
export async function comDiario(
  mudancas: Mudanca[],
  mensagem: string,
  token: string,
  contexto: Contexto,
): Promise<Mudanca[]> {
  try {
    const atual = (await lerArquivo(CAMINHO_DIARIO, token))?.conteudo ?? CABECA;
    const base = atual.includes(MARCA) ? atual : `${atual.trimEnd()}\n\n${MARCA}\n`;
    const entrada = entradaDoDiario(mudancas, mensagem, contexto);
    const conteudo = base.replace(MARCA, `${MARCA}\n\n${entrada.trimEnd()}\n\n---`).replace(/\n{3,}/g, '\n\n');
    return [...mudancas.filter((m) => m.path !== CAMINHO_DIARIO), { tipo: 'texto', path: CAMINHO_DIARIO, conteudo: `${conteudo.trimEnd()}\n` }];
  } catch {
    return mudancas;
  }
}
