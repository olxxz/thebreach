'use client';

import {
  forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef,
  useState,
} from 'react';
import {
  Bold, Code2, FileSymlink, GripVertical, Italic, Link2, Plus, Stamp,
} from 'lucide-react';
import type { ImagemPronta } from '@/components/Ilustracoes';
import {
  criarBloco, domParaLista, domParaMd, htmlDoCodigo, juntar, lerCitacao, lerImagem, lerLista,
  lerTabela, lerTitulo, listaParaHtml, listaParaMd, mdParaHtml, novoId, partir, podeSerRico,
  tabelaParaMd, type Bloco, type Tabela, type TipoDeBloco,
} from '@/lib/breach/blocos';
import { pastaDe, urlDaImagem } from '@/lib/breach/imagens';
import { labelFromPath, resolverRelativo } from '@/lib/breach/slug';

/** Um bloco na tela: o do documento, mais o que só o editor precisa saber. */
interface Vivo extends Bloco {
  /** Sobe quando o conteúdo muda por fora da digitação: é o que redesenha. */
  rev: number;
  /** O Criador pediu para editar este bloco como markdown. */
  bruto?: boolean;
}

export interface EditorVisualRef {
  /** Põe um trecho de markdown como bloco novo, depois do bloco em foco. */
  inserir: (markdown: string) => void;
}

interface Props {
  texto: string;
  onChange: (texto: string) => void;
  /** Caminho do documento no acervo: resolve as imagens relativas. */
  path: string;
  arquivos: Set<string> | null;
  pendentes?: ImagemPronta[];
  somenteLeitura?: boolean;
}

/** Os marcadores que o acervo usa (CONVENCOES.md §1), com as fontes correntes. */
const MARCADORES = [
  '[CANÔNICO]',
  '[CANÔNICO — provisório]',
  '[PROPOSTA]',
  '[PROPOSTA — ideia do Criador]',
  '[LACUNA]',
  '[ATESTADO]',
  '[CRENÇA]',
  '[DISPUTADO]',
];

interface Opcao {
  rotulo: string;
  dica?: string;
  tipo: TipoDeBloco;
  raw: string;
  bruto?: boolean;
}

const BLOCOS_NOVOS: Opcao[] = [
  { rotulo: 'Parágrafo', tipo: 'paragrafo', raw: '' },
  { rotulo: 'Afirmação canônica', dica: 'o que o Criador afirmou', tipo: 'paragrafo', raw: '`[CANÔNICO]` ' },
  { rotulo: 'Canônico provisório', dica: 'vale até segunda ordem', tipo: 'paragrafo', raw: '`[CANÔNICO — provisório]` ' },
  { rotulo: 'Proposta', dica: 'sugestão ainda não aprovada', tipo: 'paragrafo', raw: '`[PROPOSTA]` ' },
  { rotulo: 'Ideia do Criador', dica: 'proposta dele, ainda em aberto', tipo: 'paragrafo', raw: '`[PROPOSTA — ideia do Criador]` ' },
  { rotulo: 'Lacuna', dica: 'o que falta definir', tipo: 'paragrafo', raw: '`[LACUNA]` ' },
  { rotulo: 'Título de seção', tipo: 'titulo', raw: '## ' },
  { rotulo: 'Subseção', tipo: 'titulo', raw: '### ' },
  { rotulo: 'Lista', tipo: 'lista', raw: '- ' },
  { rotulo: 'Lista numerada', tipo: 'lista', raw: '1. ' },
  { rotulo: 'Tabela', tipo: 'tabela', raw: '| Coluna | Coluna |\n|---|---|\n|  |  |' },
  { rotulo: 'Recorte', dica: 'um destaque dentro do texto', tipo: 'citacao', raw: '> ' },
  { rotulo: 'Régua', dica: 'separa seções', tipo: 'regua', raw: '---' },
  { rotulo: 'Markdown livre', dica: 'escrever o bloco à mão', tipo: 'paragrafo', raw: '', bruto: true },
];

const TEXTUAIS: TipoDeBloco[] = ['paragrafo', 'titulo', 'citacao'];

/** O texto corrido de um bloco, sem o que o faz título, lista ou recorte. */
function corridoDe(bloco: Bloco): string {
  if (bloco.tipo === 'titulo') return lerTitulo(bloco.raw).texto;
  if (bloco.tipo === 'citacao') return lerCitacao(bloco.raw) ?? bloco.raw.replace(/^>\s?/gm, '');
  if (bloco.tipo === 'lista') {
    return bloco.raw.split('\n').map((linha) => linha.replace(/^\s*([-*+]|\d+[.)])\s+/, '')).join(' ');
  }
  return bloco.raw.replace(/\n/g, ' ');
}

function comoTipo(alvo: 'paragrafo' | 'h2' | 'h3' | 'lista' | 'citacao', corrido: string): Pick<Bloco, 'tipo' | 'raw'> {
  switch (alvo) {
    case 'h2':
      return { tipo: 'titulo', raw: `## ${corrido}` };
    case 'h3':
      return { tipo: 'titulo', raw: `### ${corrido}` };
    case 'lista':
      return { tipo: 'lista', raw: `- ${corrido}` };
    case 'citacao':
      return { tipo: 'citacao', raw: `> ${corrido}` };
    default:
      return { tipo: 'paragrafo', raw: corrido };
  }
}

/* --- Cursor ------------------------------------------------------------------ */

function trechoAte(raiz: HTMLElement, lado: 'antes' | 'depois'): DocumentFragment | null {
  const selecao = window.getSelection();
  if (!selecao || selecao.rangeCount === 0 || !raiz.contains(selecao.anchorNode)) return null;
  const cursor = selecao.getRangeAt(0);
  const trecho = document.createRange();
  trecho.selectNodeContents(raiz);
  if (lado === 'antes') trecho.setEnd(cursor.startContainer, cursor.startOffset);
  else trecho.setStart(cursor.endContainer, cursor.endOffset);
  return trecho.cloneContents();
}

function vazio(fragmento: DocumentFragment | null): boolean {
  if (!fragmento) return false;
  return (fragmento.textContent ?? '').replace(/​/g, '') === '' && !fragmento.querySelector('[data-md]');
}

function cursorNaPonta(raiz: HTMLElement, ponta: 'inicio' | 'fim'): boolean {
  const selecao = window.getSelection();
  if (!selecao || !selecao.isCollapsed) return false;
  return vazio(trechoAte(raiz, ponta === 'inicio' ? 'antes' : 'depois'));
}

function porCursor(raiz: HTMLElement, onde: 'inicio' | 'fim' | number): void {
  raiz.focus();
  const selecao = window.getSelection();
  if (!selecao) return;
  const range = document.createRange();
  if (typeof onde === 'number') {
    // Anda `onde` caracteres de texto; uma peça conta pelo texto que mostra.
    let falta = onde;
    const andar = (no: Node): boolean => {
      if (no.nodeType === 3) {
        const tamanho = (no.nodeValue ?? '').length;
        if (falta <= tamanho) {
          range.setStart(no, falta);
          return true;
        }
        falta -= tamanho;
        return false;
      }
      if (no.nodeType === 1 && (no as HTMLElement).dataset.md !== undefined) {
        const tamanho = (no.textContent ?? '').length;
        if (falta < tamanho) {
          range.setStartAfter(no);
          return true;
        }
        falta -= tamanho;
        return false;
      }
      for (const filho of Array.from(no.childNodes)) if (andar(filho)) return true;
      return false;
    };
    if (!andar(raiz)) {
      range.selectNodeContents(raiz);
      range.collapse(false);
    } else {
      range.collapse(true);
    }
  } else {
    range.selectNodeContents(raiz);
    range.collapse(onde === 'inicio');
  }
  selecao.removeAllRanges();
  selecao.addRange(range);
}

/* --- Um bloco ---------------------------------------------------------------- */

interface PropsDoBloco {
  bloco: Vivo;
  imagem: string | null;
  somenteLeitura: boolean;
}

/**
 * O desenho de um bloco. O HTML de dentro só é refeito quando `rev` muda: no
 * meio da digitação o DOM é do navegador, e mexer nele levaria o cursor embora.
 */
const BlocoNaTela = memo(function BlocoNaTela({ bloco, imagem, somenteLeitura }: PropsDoBloco) {
  const rico = !bloco.bruto && podeSerRico(bloco);
  const editavel = !somenteLeitura;
  // Lido só quando `rev` muda — de propósito.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => desenhar(bloco), [bloco.id, bloco.rev, rico]);
  const comum = {
    'data-editavel': bloco.id,
    contentEditable: editavel,
    suppressContentEditableWarning: true,
    spellCheck: true,
  } as const;

  if (!rico) {
    return (
      <textarea
        key={bloco.rev}
        className="ed-bruto"
        data-bruto={bloco.id}
        defaultValue={bloco.raw}
        rows={Math.max(2, bloco.raw.split('\n').length + 1)}
        readOnly={somenteLeitura}
        spellCheck={false}
        aria-label="Bloco em markdown"
        placeholder="Markdown…"
      />
    );
  }

  switch (bloco.tipo) {
    case 'titulo': {
      const Tag = `h${Math.min(lerTitulo(bloco.raw).nivel, 4)}` as 'h1' | 'h2' | 'h3' | 'h4';
      return <Tag {...comum} data-vazio="Título" dangerouslySetInnerHTML={{ __html: html }} />;
    }
    case 'citacao':
      return <blockquote {...comum} data-vazio="Recorte" dangerouslySetInnerHTML={{ __html: html }} />;
    case 'lista':
      return <div {...comum} className="ed-lista" dangerouslySetInnerHTML={{ __html: html }} />;
    case 'tabela':
      return (
        <div className="md-table ed-tabela" data-tabela={bloco.id}>
          <table dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      );
    case 'imagem': {
      const lida = lerImagem(bloco.raw);
      return (
        <figure className="ed-figura">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {imagem ? <img src={imagem} alt="" /> : <span className="ed-figura__falta">{lida?.src}</span>}
          <figcaption {...comum} data-vazio="Legenda" dangerouslySetInnerHTML={{ __html: html }} />
        </figure>
      );
    }
    case 'regua':
      return <hr />;
    default:
      return <p {...comum} data-vazio="Escreva, ou tecle / para escolher um bloco" dangerouslySetInnerHTML={{ __html: html }} />;
  }
});

function escaparTexto(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function desenharTabela(tabela: Tabela, id: string): string {
  const celula = (tag: 'th' | 'td', md: string): string =>
    `<${tag} contenteditable="true" data-editavel="${id}" data-celula="1">${mdParaHtml(md)}</${tag}>`;
  return (
    `<thead><tr>${tabela.cabeca.map((c) => celula('th', c)).join('')}</tr></thead>` +
    `<tbody>${tabela.linhas.map((linha) => `<tr>${linha.map((c) => celula('td', c)).join('')}</tr>`).join('')}</tbody>`
  );
}

function desenhar(bloco: Bloco): string {
  switch (bloco.tipo) {
    case 'titulo':
      return mdParaHtml(lerTitulo(bloco.raw).texto);
    case 'citacao':
      return mdParaHtml(lerCitacao(bloco.raw) ?? '');
    case 'lista': {
      const lista = lerLista(bloco.raw);
      return lista ? listaParaHtml(lista) : '';
    }
    case 'tabela': {
      const tabela = lerTabela(bloco.raw);
      return tabela ? desenharTabela(tabela, bloco.id) : '';
    }
    case 'imagem':
      return escaparTexto(lerImagem(bloco.raw)?.alt ?? '');
    case 'regua':
      return '';
    default:
      return mdParaHtml(bloco.raw);
  }
}

/* --- O editor ---------------------------------------------------------------- */

type Menu =
  | { tipo: 'novo'; id: string; trocar: boolean }
  | { tipo: 'bloco'; id: string }
  | { tipo: 'marcador'; id: string; peca: HTMLElement | null }
  | { tipo: 'referencia'; id: string };

/**
 * Editor visual: o documento como ele aparece no site, editável no lugar. Por
 * baixo é o mesmo markdown — cada bloco reescreve só a si mesmo.
 */
export const EditorVisual = forwardRef<EditorVisualRef, Props>(function EditorVisual(
  { texto, onChange, path, arquivos, pendentes = [], somenteLeitura = false },
  ref,
) {
  const [blocos, setBlocos] = useState<Vivo[]>(() => partir(texto).map((b) => ({ ...b, rev: 0 })));
  const [menu, setMenu] = useState<Menu | null>(null);
  const [busca, setBusca] = useState('');
  const emitido = useRef(texto);
  const vivos = useRef(blocos);
  vivos.current = blocos;
  const folha = useRef<HTMLDivElement>(null);
  const foco = useRef<{ id: string; onde: 'inicio' | 'fim' | number } | null>(null);
  const ultimoFoco = useRef<string | null>(null);
  const selecaoGuardada = useRef<Range | null>(null);

  // O texto mudou por fora — o formulário do cabeçalho, um rascunho recuperado:
  // os blocos são refeitos a partir dele.
  useEffect(() => {
    if (texto === emitido.current) return;
    emitido.current = texto;
    setBlocos(partir(texto).map((b) => ({ ...b, rev: 0 })));
  }, [texto]);

  const publicar = useCallback(
    (novos: Vivo[]) => {
      vivos.current = novos;
      setBlocos(novos);
      const saida = juntar(novos);
      emitido.current = saida;
      onChange(saida);
    },
    [onChange],
  );

  useLayoutEffect(() => {
    const pedido = foco.current;
    if (!pedido) return;
    foco.current = null;
    const alvo = folha.current?.querySelector<HTMLElement>(
      `[data-editavel="${pedido.id}"], [data-bruto="${pedido.id}"]`,
    );
    if (!alvo) return;
    if (alvo instanceof HTMLTextAreaElement) alvo.focus();
    else porCursor(alvo, pedido.onde);
  }, [blocos]);

  const indiceDe = (id: string): number => vivos.current.findIndex((b) => b.id === id);

  /** Troca um bloco por outros, ou o tira. `rev` novo redesenha o que entrou. */
  const trocar = useCallback(
    (id: string, por: Array<Partial<Vivo> & Pick<Bloco, 'tipo' | 'raw'>>, focar?: { n: number; onde: 'inicio' | 'fim' | number }) => {
      const lista = vivos.current;
      const i = lista.findIndex((b) => b.id === id);
      if (i === -1) return;
      const velho = lista[i];
      const novos: Vivo[] = por.map((parte, k) => ({
        id: k === 0 && parte.id === undefined ? velho.id : (parte.id ?? novoId()),
        sep: k === por.length - 1 ? velho.sep : '\n\n',
        rev: velho.rev + 1 + k,
        ...parte,
      }));
      // Quem ganha um vizinho depois de si precisa de uma linha em branco.
      for (let k = 0; k < novos.length - 1; k += 1) {
        if (!novos[k].sep.includes('\n\n')) novos[k].sep = '\n\n';
      }
      if (focar && novos[focar.n]) foco.current = { id: novos[focar.n].id, onde: focar.onde };
      publicar([...lista.slice(0, i), ...novos, ...lista.slice(i + 1)]);
    },
    [publicar],
  );

  const inserirDepois = useCallback(
    (id: string | null, novos: Array<Pick<Bloco, 'tipo' | 'raw'> & { bruto?: boolean }>, focar = true) => {
      const lista = [...vivos.current];
      let i = id ? lista.findIndex((b) => b.id === id) : lista.length - 1;
      if (i === -1) i = lista.length - 1;
      const criados: Vivo[] = novos.map((n) => ({ ...criarBloco(n.tipo, n.raw), rev: 0, bruto: n.bruto }));
      if (i >= 0) {
        const anterior = { ...lista[i] };
        criados[criados.length - 1].sep = anterior.sep.includes('\n\n') || i < lista.length - 1 ? '\n\n' : anterior.sep || '\n';
        if (i === lista.length - 1) criados[criados.length - 1].sep = anterior.sep || '\n';
        anterior.sep = '\n\n';
        lista[i] = anterior;
      }
      lista.splice(i + 1, 0, ...criados);
      if (focar) foco.current = { id: criados[criados.length - 1].id, onde: 'fim' };
      publicar(lista);
    },
    [publicar],
  );

  useImperativeHandle(
    ref,
    () => ({
      inserir: (markdown: string) => {
        const novos = partir(markdown.trim()).filter((b) => b.raw !== '');
        if (novos.length) inserirDepois(ultimoFoco.current, novos);
      },
    }),
    [inserirDepois],
  );

  /** Lê do DOM o markdown de um bloco que acabou de ser digitado. */
  const lerDoDom = (bloco: Vivo, raiz: HTMLElement): string => {
    switch (bloco.tipo) {
      case 'titulo':
        return `${'#'.repeat(lerTitulo(bloco.raw).nivel)} ${domParaMd(raiz).replace(/\n/g, ' ')}`;
      case 'citacao':
        return `> ${domParaMd(raiz).replace(/\n/g, ' ')}`;
      case 'lista': {
        const lista = raiz.querySelector('ul, ol');
        return lista ? listaParaMd(domParaLista(lista)) : domParaMd(raiz);
      }
      case 'tabela': {
        const caixa = raiz.closest('table');
        const velha = lerTabela(bloco.raw);
        if (!caixa || !velha) return bloco.raw;
        const linha = (tr: Element): string[] =>
          Array.from(tr.children).map((c) => domParaMd(c).replace(/\n/g, ' ').replace(/\|/g, '\\|').trim());
        return tabelaParaMd({
          cabeca: linha(caixa.querySelector('thead tr') as Element),
          alinhamento: velha.alinhamento,
          linhas: Array.from(caixa.querySelectorAll('tbody tr')).map(linha),
        });
      }
      case 'imagem': {
        const lida = lerImagem(bloco.raw);
        return `![${(raiz.textContent ?? '').replace(/[\[\]\n]/g, ' ').trim()}](${lida?.src ?? ''})`;
      }
      default:
        return domParaMd(raiz);
    }
  };

  const aoDigitar = (event: React.FormEvent<HTMLDivElement>): void => {
    const alvo = event.target as HTMLElement;

    if (alvo instanceof HTMLTextAreaElement && alvo.dataset.bruto) {
      const id = alvo.dataset.bruto;
      publicar(vivos.current.map((b) => (b.id === id ? { ...b, raw: alvo.value } : b)));
      return;
    }

    const raiz = alvo.closest<HTMLElement>('[data-editavel]');
    if (!raiz) return;
    const id = raiz.dataset.editavel as string;
    const bloco = vivos.current.find((b) => b.id === id);
    if (!bloco) return;

    // Atalhos de quem conhece markdown: `## `, `- `, `> `, `1. `.
    if (bloco.tipo === 'paragrafo') {
      const digitado = (raiz.textContent ?? '').replace(/ /g, ' ');
      const atalho = /^(#{1,4}|[-*]|>|1\.)\s$/.exec(digitado);
      if (atalho) {
        const sinal = atalho[1];
        const tipo: TipoDeBloco = sinal.startsWith('#') ? 'titulo' : sinal === '>' ? 'citacao' : 'lista';
        trocar(id, [{ tipo, raw: `${sinal === '*' ? '-' : sinal} ` }], { n: 0, onde: 'fim' });
        return;
      }
    }

    // A lista esvaziada pelo navegador volta a ser parágrafo.
    if (bloco.tipo === 'lista' && !raiz.querySelector('li')) {
      trocar(id, [{ tipo: 'paragrafo', raw: domParaMd(raiz).trim() }], { n: 0, onde: 'fim' });
      return;
    }

    const raw = lerDoDom(bloco, raiz);
    if (raw === bloco.raw) return;
    publicar(vivos.current.map((b) => (b.id === id ? { ...b, raw } : b)));
  };

  const aoTeclar = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && menu) {
      setMenu(null);
      return;
    }
    const alvo = event.target as HTMLElement;
    if (alvo instanceof HTMLTextAreaElement) return;
    const raiz = alvo.closest<HTMLElement>('[data-editavel]');
    if (!raiz) return;
    const id = raiz.dataset.editavel as string;
    const lista = vivos.current;
    const i = indiceDe(id);
    const bloco = lista[i];
    if (!bloco) return;
    const visiveis = (passo: 1 | -1): Vivo | undefined => {
      for (let k = i + passo; k >= 0 && k < lista.length; k += passo) {
        const b = lista[k];
        if (b.tipo !== 'campo' && b.tipo !== 'regua' && !(b.tipo === 'paragrafo' && b.raw === '' && !b.bruto)) return b;
      }
      return undefined;
    };

    if (event.key === '/' && bloco.tipo === 'paragrafo' && (raiz.textContent ?? '') === '') {
      event.preventDefault();
      setMenu({ tipo: 'novo', id, trocar: true });
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      if (raiz.dataset.celula) {
        event.preventDefault();
        return;
      }
      if (bloco.tipo === 'lista') {
        const li = window.getSelection()?.anchorNode
          ? (window.getSelection()?.anchorNode as Node).parentElement?.closest('li') ??
            ((window.getSelection()?.anchorNode as HTMLElement).closest?.('li') as HTMLElement | null)
          : null;
        // Enter num item vazio sai da lista.
        if (li && (li.textContent ?? '').trim() === '' && !li.querySelector('[data-md]')) {
          event.preventDefault();
          li.remove();
          const resto = raiz.querySelector('li') ? lerDoDom(bloco, raiz) : null;
          if (resto === null) trocar(id, [{ tipo: 'paragrafo', raw: '' }], { n: 0, onde: 'inicio' });
          else trocar(id, [{ tipo: 'lista', raw: resto }, { tipo: 'paragrafo', raw: '' }], { n: 1, onde: 'inicio' });
        }
        return;
      }
      if (bloco.tipo === 'imagem') {
        event.preventDefault();
        inserirDepois(id, [{ tipo: 'paragrafo', raw: '' }]);
        return;
      }
      if (TEXTUAIS.includes(bloco.tipo)) {
        event.preventDefault();
        const antes = domParaMd(trechoAte(raiz, 'antes') ?? document.createDocumentFragment());
        const depois = domParaMd(trechoAte(raiz, 'depois') ?? document.createDocumentFragment());
        const prefixo = bloco.tipo === 'titulo' ? `${'#'.repeat(lerTitulo(bloco.raw).nivel)} ` : bloco.tipo === 'citacao' ? '> ' : '';
        trocar(
          id,
          [
            { tipo: bloco.tipo, raw: `${prefixo}${antes.trimEnd()}` },
            { tipo: 'paragrafo', raw: depois.trimStart() },
          ],
          { n: 1, onde: 'inicio' },
        );
      }
      return;
    }

    if (event.key === 'Backspace' && cursorNaPonta(raiz, 'inicio') && !raiz.dataset.celula) {
      if (bloco.tipo === 'titulo' || bloco.tipo === 'citacao') {
        event.preventDefault();
        trocar(id, [{ tipo: 'paragrafo', raw: corridoDe(bloco) }], { n: 0, onde: 'inicio' });
        return;
      }
      if (bloco.tipo === 'paragrafo') {
        const anterior = visiveis(-1);
        if (!anterior) return;
        event.preventDefault();
        if (TEXTUAIS.includes(anterior.tipo) && podeSerRico(anterior) && !anterior.bruto) {
          const el = folha.current?.querySelector<HTMLElement>(`[data-editavel="${anterior.id}"]`);
          const junta = (el?.textContent ?? '').length;
          const novos = lista
            .filter((b) => b.id !== id)
            .map((b) => (b.id === anterior.id ? { ...b, raw: b.raw + bloco.raw, sep: bloco.sep, rev: b.rev + 1 } : b));
          foco.current = { id: anterior.id, onde: junta };
          publicar(novos);
        } else if (bloco.raw === '') {
          foco.current = { id: anterior.id, onde: 'fim' };
          publicar(lista.filter((b) => b.id !== id));
        }
      }
      return;
    }

    if (event.key === 'ArrowUp' && cursorNaPonta(raiz, 'inicio')) {
      const anterior = visiveis(-1);
      if (anterior) {
        event.preventDefault();
        const el = folha.current?.querySelector<HTMLElement>(`[data-editavel="${anterior.id}"], [data-bruto="${anterior.id}"]`);
        if (el instanceof HTMLTextAreaElement) el.focus();
        else if (el) porCursor(el, 'fim');
      }
    }
    if (event.key === 'ArrowDown' && cursorNaPonta(raiz, 'fim')) {
      const seguinte = visiveis(1);
      if (seguinte) {
        event.preventDefault();
        const el = folha.current?.querySelector<HTMLElement>(`[data-editavel="${seguinte.id}"], [data-bruto="${seguinte.id}"]`);
        if (el instanceof HTMLTextAreaElement) el.focus();
        else if (el) porCursor(el, 'inicio');
      }
    }
  };

  /** Colar entra como texto: o que vem com formatação de fora não é do acervo. */
  const aoColar = (event: React.ClipboardEvent<HTMLDivElement>): void => {
    const alvo = event.target as HTMLElement;
    if (alvo instanceof HTMLTextAreaElement) return;
    const raiz = alvo.closest<HTMLElement>('[data-editavel]');
    if (!raiz) return;
    event.preventDefault();
    const colado = event.clipboardData.getData('text/plain').replace(/\r\n/g, '\n');
    if (!colado.includes('\n') || raiz.dataset.celula) {
      document.execCommand('insertText', false, colado.replace(/\n/g, ' '));
      return;
    }
    const novos = partir(colado.trim()).filter((b) => b.raw !== '');
    inserirDepois(raiz.dataset.editavel as string, novos);
  };

  /** O bloco em markdown, ao perder o foco, é relido e volta a ser visual. */
  const aoSair = (event: React.FocusEvent<HTMLDivElement>): void => {
    const alvo = event.target as HTMLElement;
    if (!(alvo instanceof HTMLTextAreaElement) || !alvo.dataset.bruto) return;
    const id = alvo.dataset.bruto;
    const bloco = vivos.current.find((b) => b.id === id);
    if (!bloco) return;
    const relidos = partir(bloco.raw).filter((b) => b.raw !== '');
    if (relidos.length === 0) {
      if (bloco.raw.trim() === '') publicar(vivos.current.filter((b) => b.id !== id));
      return;
    }
    trocar(id, relidos.map((b) => ({ tipo: b.tipo, raw: b.raw, bruto: false })));
  };

  const aoFocar = (event: React.FocusEvent<HTMLDivElement>): void => {
    const dono = (event.target as HTMLElement).closest<HTMLElement>('[data-bloco]');
    if (dono?.dataset.bloco) ultimoFoco.current = dono.dataset.bloco;
  };

  const aoClicar = (event: React.MouseEvent<HTMLDivElement>): void => {
    const alvo = event.target as HTMLElement;
    const link = alvo.closest('a[data-href]');
    if (link) event.preventDefault();
    const selo = alvo.closest<HTMLElement>('.marker.ed-peca');
    const dono = alvo.closest<HTMLElement>('[data-bloco]');
    if (selo && dono?.dataset.bloco && !somenteLeitura) {
      setMenu({ tipo: 'marcador', id: dono.dataset.bloco, peca: selo });
    }
  };

  /* --- Barra de ferramentas -------------------------------------------------- */

  const guardarSelecao = (): void => {
    const selecao = window.getSelection();
    selecaoGuardada.current =
      selecao && selecao.rangeCount > 0 && folha.current?.contains(selecao.anchorNode)
        ? selecao.getRangeAt(0).cloneRange()
        : null;
  };

  const devolverSelecao = (): boolean => {
    const guardada = selecaoGuardada.current;
    if (!guardada) return false;
    const selecao = window.getSelection();
    selecao?.removeAllRanges();
    selecao?.addRange(guardada);
    return true;
  };

  const comando = (nome: 'bold' | 'italic'): void => {
    document.execCommand(nome);
  };

  const porHtml = (html: string): void => {
    document.execCommand('insertHTML', false, html);
  };

  const porCodigo = (): void => {
    const escolhido = window.getSelection()?.toString() ?? '';
    porHtml(`<code>${escaparTexto(escolhido || 'código')}</code>&nbsp;`);
  };

  const porLink = (): void => {
    guardarSelecao();
    const endereco = window.prompt('Endereço do link (caminho relativo ou https://…)');
    if (!endereco || !devolverSelecao()) return;
    const escolhido = window.getSelection()?.toString() || endereco;
    porHtml(`<a href="#" data-href="${endereco.replace(/"/g, '%22')}">${escaparTexto(escolhido)}</a>`);
  };

  const escolherMarcador = (marcador: string | null): void => {
    if (menu?.tipo !== 'marcador') return;
    const { peca, id } = menu;
    setMenu(null);
    if (peca) {
      // Troca o selo no lugar e avisa o bloco de que mudou.
      const raiz = peca.closest<HTMLElement>('[data-editavel]');
      if (marcador) peca.outerHTML = htmlDoCodigo(`\`${marcador}\``);
      else peca.remove();
      raiz?.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (!marcador) return;
    if (devolverSelecao()) {
      porHtml(`${htmlDoCodigo(`\`${marcador}\``)}&nbsp;`);
      return;
    }
    inserirDepois(id || null, [{ tipo: 'paragrafo', raw: `\`${marcador}\` ` }]);
  };

  const documentos = useMemo(() => {
    if (!arquivos) return [];
    return [...arquivos]
      .filter((a) => a.endsWith('.md') && /^\d{2}-/.test(a) && !a.startsWith('00-'))
      .map((a) => (a.endsWith('/README.md') ? a.replace(/README\.md$/, '') : a))
      .map((caminho) => ({ caminho, nome: labelFromPath(caminho) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [arquivos]);

  const achados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = termo
      ? documentos.filter((d) => d.nome.toLowerCase().includes(termo) || d.caminho.toLowerCase().includes(termo))
      : documentos;
    return lista.slice(0, 40);
  }, [documentos, busca]);

  const escolherReferencia = (caminho: string): void => {
    setMenu(null);
    setBusca('');
    if (devolverSelecao()) porHtml(`${htmlDoCodigo(`\`${caminho}\``)}&nbsp;`);
  };

  /* --- Menus de bloco -------------------------------------------------------- */

  const escolherNovo = (opcao: Opcao): void => {
    if (menu?.tipo !== 'novo') return;
    const { id, trocar: noLugar } = menu;
    setMenu(null);
    const novo = { tipo: opcao.tipo, raw: opcao.raw, bruto: opcao.bruto };
    if (noLugar) trocar(id, [novo], { n: 0, onde: 'fim' });
    else inserirDepois(id, [novo]);
  };

  const mover = (id: string, passo: 1 | -1): void => {
    const lista = [...vivos.current];
    const i = lista.findIndex((b) => b.id === id);
    let j = i + passo;
    // Régua e cabeçalho não contam como vizinho: pula-se por cima deles.
    while (j >= 0 && j < lista.length && lista[j].tipo === 'campo') j += passo;
    if (i === -1 || j < 0 || j >= lista.length) return;
    const [a, b] = [lista[i], lista[j]];
    lista[i] = { ...b, sep: a.sep };
    lista[j] = { ...a, sep: b.sep };
    setMenu(null);
    publicar(lista);
  };

  const apagar = (id: string): void => {
    setMenu(null);
    publicar(vivos.current.filter((b) => b.id !== id));
  };

  const transformar = (id: string, alvo: Parameters<typeof comoTipo>[0]): void => {
    const bloco = vivos.current.find((b) => b.id === id);
    setMenu(null);
    if (bloco) trocar(id, [{ ...comoTipo(alvo, corridoDe(bloco)), bruto: false }], { n: 0, onde: 'fim' });
  };

  const mudarTabela = (id: string, mudanca: (tabela: Tabela) => void): void => {
    const bloco = vivos.current.find((b) => b.id === id);
    const tabela = bloco ? lerTabela(bloco.raw) : null;
    setMenu(null);
    if (!tabela) return;
    mudanca(tabela);
    trocar(id, [{ tipo: 'tabela', raw: tabelaParaMd(tabela) }]);
  };

  /* --- Desenho --------------------------------------------------------------- */

  const pasta = pastaDe(path);
  const imagemDe = (bloco: Vivo): string | null => {
    if (bloco.tipo !== 'imagem') return null;
    const lida = lerImagem(bloco.raw);
    if (!lida) return null;
    if (/^(https?:|data:)/i.test(lida.src)) return lida.src;
    const noAcervo = lida.src.startsWith('/') ? lida.src.slice(1) : resolverRelativo(pasta, lida.src);
    return pendentes.find((p) => p.path === noAcervo)?.objectURL ?? urlDaImagem(noAcervo);
  };

  const blocoDoMenu = menu ? blocos.find((b) => b.id === menu.id) : undefined;

  const menuDe = (bloco: Vivo): React.ReactNode => {
    if (!menu || menu.id !== bloco.id) return null;
    if (menu.tipo === 'novo') {
      return (
        <div className="ed-menu" role="menu">
          {BLOCOS_NOVOS.map((opcao) => (
            <button key={opcao.rotulo} type="button" role="menuitem" onClick={() => escolherNovo(opcao)}>
              <b>{opcao.rotulo}</b>
              {opcao.dica ? <span>{opcao.dica}</span> : null}
            </button>
          ))}
        </div>
      );
    }
    if (menu.tipo === 'marcador') {
      return (
        <div className="ed-menu" role="menu">
          {MARCADORES.map((marcador) => (
            <button key={marcador} type="button" role="menuitem" onClick={() => escolherMarcador(marcador)}>
              <span dangerouslySetInnerHTML={{ __html: htmlDoCodigo(`\`${marcador}\``) }} />
            </button>
          ))}
          {menu.peca ? (
            <button type="button" role="menuitem" onClick={() => escolherMarcador(null)}>
              <b>Tirar o marcador</b>
            </button>
          ) : null}
        </div>
      );
    }
    if (menu.tipo === 'referencia') {
      return (
        <div className="ed-menu ed-menu--busca" role="dialog" aria-label="Citar um documento">
          <input
            autoFocus
            type="search"
            value={busca}
            placeholder="Citar qual documento?"
            onChange={(event) => setBusca(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && achados[0]) escolherReferencia(achados[0].caminho);
              event.stopPropagation();
            }}
          />
          {achados.map((doc) => (
            <button key={doc.caminho} type="button" onClick={() => escolherReferencia(doc.caminho)}>
              <b>{doc.nome}</b>
              <span>{doc.caminho}</span>
            </button>
          ))}
        </div>
      );
    }
    const textual = ['paragrafo', 'titulo', 'citacao', 'lista'].includes(bloco.tipo);
    return (
      <div className="ed-menu" role="menu">
        <button type="button" role="menuitem" onClick={() => mover(bloco.id, -1)}>
          <b>Mover para cima</b>
        </button>
        <button type="button" role="menuitem" onClick={() => mover(bloco.id, 1)}>
          <b>Mover para baixo</b>
        </button>
        {textual ? (
          <>
            <p>Transformar em</p>
            <button type="button" role="menuitem" onClick={() => transformar(bloco.id, 'paragrafo')}>
              <b>Parágrafo</b>
            </button>
            <button type="button" role="menuitem" onClick={() => transformar(bloco.id, 'h2')}>
              <b>Título de seção</b>
            </button>
            <button type="button" role="menuitem" onClick={() => transformar(bloco.id, 'h3')}>
              <b>Subseção</b>
            </button>
            <button type="button" role="menuitem" onClick={() => transformar(bloco.id, 'lista')}>
              <b>Lista</b>
            </button>
            <button type="button" role="menuitem" onClick={() => transformar(bloco.id, 'citacao')}>
              <b>Recorte</b>
            </button>
          </>
        ) : null}
        {bloco.tipo === 'tabela' ? (
          <>
            <p>Tabela</p>
            <button type="button" role="menuitem" onClick={() => mudarTabela(bloco.id, (t) => t.linhas.push(t.cabeca.map(() => '')))}>
              <b>Mais uma linha</b>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                mudarTabela(bloco.id, (t) => {
                  t.cabeca.push('Coluna');
                  t.alinhamento.push('---');
                  t.linhas.forEach((linha) => linha.push(''));
                })
              }
            >
              <b>Mais uma coluna</b>
            </button>
            <button type="button" role="menuitem" onClick={() => mudarTabela(bloco.id, (t) => t.linhas.pop())}>
              <b>Tirar a última linha</b>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() =>
                mudarTabela(bloco.id, (t) => {
                  if (t.cabeca.length < 2) return;
                  t.cabeca.pop();
                  t.alinhamento.pop();
                  t.linhas.forEach((linha) => linha.pop());
                })
              }
            >
              <b>Tirar a última coluna</b>
            </button>
          </>
        ) : null}
        <p>Bloco</p>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setMenu(null);
            foco.current = { id: bloco.id, onde: 'fim' };
            publicar(vivos.current.map((b) => (b.id === bloco.id ? { ...b, bruto: true, rev: b.rev + 1 } : b)));
          }}
        >
          <b>Editar como markdown</b>
        </button>
        <button type="button" role="menuitem" className="ed-menu__perigo" onClick={() => apagar(bloco.id)}>
          <b>Apagar o bloco</b>
        </button>
      </div>
    );
  };

  const naoToma = (event: React.MouseEvent): void => event.preventDefault();

  return (
    <div className="ed">
      {!somenteLeitura ? (
        <div className="ed-barra" role="toolbar" aria-label="Formatação">
          <button type="button" onMouseDown={naoToma} onClick={() => comando('bold')} title="Negrito (Ctrl+B)">
            <Bold size={16} aria-hidden="true" />
          </button>
          <button type="button" onMouseDown={naoToma} onClick={() => comando('italic')} title="Itálico (Ctrl+I)">
            <Italic size={16} aria-hidden="true" />
          </button>
          <button type="button" onMouseDown={naoToma} onClick={porCodigo} title="Código">
            <Code2 size={16} aria-hidden="true" />
          </button>
          <button type="button" onMouseDown={naoToma} onClick={porLink} title="Link">
            <Link2 size={16} aria-hidden="true" />
          </button>
          <span className="ed-barra__fio" />
          <button
            type="button"
            className="ed-barra__largo"
            onMouseDown={naoToma}
            onClick={() => {
              guardarSelecao();
              setMenu({ tipo: 'marcador', id: ultimoFoco.current ?? blocos[blocos.length - 1]?.id ?? '', peca: null });
            }}
            title="Pôr um marcador onde está o cursor"
          >
            <Stamp size={16} aria-hidden="true" /> Marcador
          </button>
          <button
            type="button"
            className="ed-barra__largo"
            onMouseDown={naoToma}
            onClick={() => {
              guardarSelecao();
              if (!selecaoGuardada.current) return;
              setMenu({ tipo: 'referencia', id: ultimoFoco.current ?? '' });
            }}
            title="Citar um documento do acervo onde está o cursor"
          >
            <FileSymlink size={16} aria-hidden="true" /> Citar documento
          </button>
        </div>
      ) : null}

      <div
        ref={folha}
        className="ed-folha prose"
        onInput={aoDigitar}
        onKeyDown={aoTeclar}
        onPaste={aoColar}
        onBlur={aoSair}
        onFocus={aoFocar}
        onClick={aoClicar}
      >
        {blocos.map((bloco) => {
          if (bloco.tipo === 'campo') return null;
          if (bloco.tipo === 'paragrafo' && bloco.raw === '' && !bloco.bruto && bloco.rev === 0 && bloco.sep.trim() === '' && blocos[0] === bloco) {
            return null;
          }
          return (
            <div
              className="ed-bloco"
              data-bloco={bloco.id}
              data-tipo={bloco.tipo}
              data-aberto={menu?.id === bloco.id}
              key={bloco.id}
            >
              {!somenteLeitura ? (
                <span className="ed-alca" contentEditable={false}>
                  <button
                    type="button"
                    onMouseDown={naoToma}
                    onClick={() => setMenu(menu?.id === bloco.id && menu.tipo === 'novo' ? null : { tipo: 'novo', id: bloco.id, trocar: false })}
                    aria-label="Pôr um bloco abaixo"
                    title="Pôr um bloco abaixo"
                  >
                    <Plus size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={naoToma}
                    onClick={() => setMenu(menu?.id === bloco.id && menu.tipo === 'bloco' ? null : { tipo: 'bloco', id: bloco.id })}
                    aria-label="Mover, transformar ou apagar"
                    title="Mover, transformar ou apagar"
                  >
                    <GripVertical size={15} aria-hidden="true" />
                  </button>
                </span>
              ) : null}
              <BlocoNaTela bloco={bloco} imagem={imagemDe(bloco)} somenteLeitura={somenteLeitura} />
              {menuDe(bloco)}
            </div>
          );
        })}

        {!somenteLeitura ? (
          <button
            type="button"
            className="ed-fim"
            onClick={() => inserirDepois(null, [{ tipo: 'paragrafo', raw: '' }])}
          >
            <Plus size={15} aria-hidden="true" /> Novo bloco
          </button>
        ) : null}
      </div>
      {menu && !blocoDoMenu ? <div className="ed-solto">{menuDe({ id: menu.id } as Vivo)}</div> : null}
      {menu ? <button type="button" className="ed-veu" aria-label="Fechar o menu" onClick={() => setMenu(null)} /> : null}
    </div>
  );
});
