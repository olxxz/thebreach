/**
 * Uma explicação curta do que mudou num documento, para a janela de gravar.
 *
 * Feita aqui mesmo, sem rede: compara o antes e o depois por seção e conta
 * parágrafos, marcadores e campos da ficha. Não adivinha intenção — diz onde
 * mexeu e quanto, nos termos do acervo. Também sugere o assunto do commit,
 * que o Criador pode aceitar ou reescrever.
 */

interface Secao {
  titulo: string;
  blocos: string[];
}

const CAMPOS = ['Classificação', 'Status', 'Fontes internas', 'Documentos relacionados', 'Relações'];

function semNumero(titulo: string): string {
  return titulo.replace(/^\d+(\.\d+)*\.?\s*/, '').trim();
}

function secoes(markdown: string): Secao[] {
  const lista: Secao[] = [{ titulo: '', blocos: [] }];
  for (const bloco of markdown.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const limpo = bloco.trim();
    if (!limpo || /^-{3,}$/.test(limpo) || /^\*\*[^*]+:\*\*/.test(limpo)) continue;
    const titulo = /^#{2,3}\s+(.+)$/.exec(limpo.split('\n')[0]);
    if (titulo) {
      lista.push({ titulo: semNumero(titulo[1]), blocos: [] });
      const resto = limpo.split('\n').slice(1).join('\n').trim();
      if (resto) lista[lista.length - 1].blocos.push(resto);
      continue;
    }
    if (/^#\s/.test(limpo)) continue;
    lista[lista.length - 1].blocos.push(limpo);
  }
  return lista;
}

function campo(markdown: string, nome: string): string | null {
  const m = new RegExp(`^\\*\\*${nome}:\\*\\*\\s*(.*)$`, 'm').exec(markdown);
  return m ? m[1].trim() : null;
}

function titulo(markdown: string): string | null {
  return /^#\s+(.+)$/m.exec(markdown)?.[1].trim() ?? null;
}

function marcadores(blocos: string[]): Map<string, number> {
  const conta = new Map<string, number>();
  for (const bloco of blocos) {
    for (const [, dentro] of bloco.matchAll(/`\[\s*([^\]`—–:-]+?)\s*(?:[—–:-][^\]`]*)?\]`/g)) {
      const id = dentro.trim().toUpperCase();
      conta.set(id, (conta.get(id) ?? 0) + 1);
    }
  }
  return conta;
}

function imagens(markdown: string): Set<string> {
  return new Set([...markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].map((m) => m[1]));
}

function plural(n: number, um: string, varios: string): string {
  return `${n === 1 ? 'um' : n} ${n === 1 ? um : varios}`;
}

function listaPt(itens: string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

export interface Explicacao {
  /** Frases curtas, uma por mudança. */
  frases: string[];
  /** Assunto sugerido para o commit, sem o prefixo da categoria. */
  assunto: string;
}

export function explicarMudanca(antes: string, depois: string): Explicacao {
  const frases: string[] = [];
  const tocadas: string[] = [];

  const tAntes = titulo(antes);
  const tDepois = titulo(depois);
  if (tAntes !== tDepois && tDepois) frases.push(`O título passa a ser “${tDepois}”${tAntes ? ` (era “${tAntes}”)` : ''}.`);

  for (const nome of CAMPOS) {
    const a = campo(antes, nome);
    const d = campo(depois, nome);
    if (a === d) continue;
    if (nome === 'Status' && a && d) frases.push(`Status: ${a} → ${d}.`);
    else frases.push(`Ficha: ${nome.toLowerCase()} ${a ? 'mudou' : 'preenchida'}.`);
  }

  const sAntes = secoes(antes);
  const sDepois = secoes(depois);
  const porTitulo = new Map(sAntes.map((s) => [s.titulo, s]));
  const titulosDepois = new Set(sDepois.map((s) => s.titulo));

  for (const secao of sDepois) {
    const velha = porTitulo.get(secao.titulo);
    const nome = secao.titulo || 'a abertura';
    if (!velha) {
      if (secao.titulo) {
        frases.push(`Seção nova: ${secao.titulo}.`);
        tocadas.push(secao.titulo);
      }
      continue;
    }
    const antesSet = new Set(velha.blocos);
    const depoisSet = new Set(secao.blocos);
    const novos = secao.blocos.filter((b) => !antesSet.has(b));
    const saidos = velha.blocos.filter((b) => !depoisSet.has(b));
    if (!novos.length && !saidos.length) continue;
    tocadas.push(secao.titulo || 'abertura');

    const reescritos = Math.min(novos.length, saidos.length);
    const partes: string[] = [];
    if (novos.length > reescritos) partes.push(plural(novos.length - reescritos, 'trecho novo', 'trechos novos'));
    if (reescritos) partes.push(plural(reescritos, 'trecho reescrito', 'trechos reescritos'));
    if (saidos.length > reescritos) partes.push(plural(saidos.length - reescritos, 'trecho tirado', 'trechos tirados'));

    const mA = marcadores(velha.blocos);
    const mD = marcadores(secao.blocos);
    const marcas: string[] = [];
    for (const id of new Set([...mA.keys(), ...mD.keys()])) {
      const diferenca = (mD.get(id) ?? 0) - (mA.get(id) ?? 0);
      if (diferenca) marcas.push(`${diferenca > 0 ? '+' : '−'}${Math.abs(diferenca)} ${id}`);
    }
    frases.push(`Em ${nome}: ${listaPt(partes)}${marcas.length ? ` (${marcas.join(', ')})` : ''}.`);
  }

  for (const secao of sAntes) {
    if (secao.titulo && !titulosDepois.has(secao.titulo)) {
      frases.push(`Seção removida: ${secao.titulo}.`);
      tocadas.push(secao.titulo);
    }
  }

  const iAntes = imagens(antes);
  const novasImagens = [...imagens(depois)].filter((i) => !iAntes.has(i));
  if (novasImagens.length) {
    frases.push(
      novasImagens.some((i) => /^hero\./.test(i))
        ? 'Ilustração de abertura nova.'
        : `${novasImagens.length === 1 ? 'Uma ilustração nova citada' : `${novasImagens.length} ilustrações novas citadas`}.`,
    );
  }

  if (!frases.length) frases.push('Só a data de atualização muda.');

  const unicas = [...new Set(tocadas)].map((t) => t.toLowerCase());
  const assunto = unicas.length
    ? `${tDepois ?? 'documento'}: atualiza ${listaPt(unicas.slice(0, 3))}${unicas.length > 3 ? ' e mais' : ''}`
    : tAntes !== tDepois && tDepois
      ? `renomeia para ${tDepois}`
      : `${tDepois ?? 'documento'}: ajusta a ficha`;

  return { frases, assunto };
}
