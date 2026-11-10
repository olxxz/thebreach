'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppearance } from '@/components/AppearanceProvider';
import { semCabecalho } from '@/lib/breach/cabecalho';
import { lerArquivo, lerMidia } from '@/lib/breach/github';
import { BASE_PATH } from '@/lib/breach/slug';
import { renderMarkdown } from '@/lib/breach/markdown';

interface Props {
  /** Caminho do documento no acervo. */
  path: string;
  /** Os documentos que o público vê. Link para os outros leva ao Ateliê. */
  publicos: ReadonlySet<string>;
  /** Markdown já lido, quando quem chama já o tem. */
  bruto?: string | null;
}

const PREFIXO_MIDIA = `${BASE_PATH}/acervo/`;

/** Rota do Ateliê para um documento. */
export function rotaNoAtelie(path: string): string {
  return `/atelie?d=${encodeURIComponent(path)}`;
}

/**
 * O documento inteiro, com propostas e lacunas — como ele é no acervo.
 *
 * Lê do GitHub com o token do Ateliê e passa pelo mesmo pipeline do build
 * (`renderMarkdown`), então os marcadores e as referências saem iguais aos da
 * página pública. Duas diferenças, por ser o Ateliê: a mídia que o build não
 * copiou é buscada no acervo na hora, e o link para um documento que o
 * público não vê leva a ele dentro do Ateliê.
 */
export function VersaoCompleta({ path, publicos, bruto: brutoDado = null }: Props) {
  const { token } = useAppearance();
  const router = useRouter();
  const [bruto, setBruto] = useState<string | null>(brutoDado);
  const [html, setHtml] = useState('');
  const [erro, setErro] = useState('');
  const folha = useRef<HTMLDivElement>(null);

  useEffect(() => setBruto(brutoDado), [brutoDado]);

  useEffect(() => {
    if (brutoDado !== null || !token) return;
    let cancelado = false;
    lerArquivo(path, token)
      .then((arquivo) => {
        if (cancelado) return;
        if (!arquivo) setErro(`${path} não existe no acervo.`);
        else setBruto(arquivo.conteudo);
      })
      .catch((e: unknown) => !cancelado && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelado = true;
    };
  }, [path, token, brutoDado]);

  useEffect(() => {
    if (bruto === null) return;
    let cancelado = false;
    renderMarkdown(semCabecalho(bruto), path)
      .then((saida) => !cancelado && setHtml(saida))
      .catch(() => !cancelado && setErro('Não deu para renderizar este documento.'));
    return () => {
      cancelado = true;
    };
  }, [bruto, path]);

  // Mídia do Ateliê: a imagem que falha no site é buscada no acervo.
  useEffect(() => {
    const raiz = folha.current;
    if (!raiz || !token || !html) return;
    const criadas: string[] = [];
    const trocar = (img: HTMLImageElement): void => {
      const src = img.getAttribute('src') ?? '';
      if (!src.startsWith(PREFIXO_MIDIA) || img.dataset.atelie) return;
      img.dataset.atelie = '1';
      lerMidia(decodeURIComponent(src.slice(PREFIXO_MIDIA.length)), token)
        .then((url) => {
          criadas.push(url);
          img.src = url;
        })
        .catch(() => undefined);
    };
    const imagens = [...raiz.querySelectorAll('img')];
    for (const img of imagens) {
      if (img.complete && img.naturalWidth === 0) trocar(img);
      else img.addEventListener('error', () => trocar(img), { once: true });
    }
    for (const botao of raiz.querySelectorAll<HTMLElement>('.pronuncia[data-audio]')) {
      const src = botao.dataset.audio ?? '';
      if (!src.startsWith(PREFIXO_MIDIA)) continue;
      fetch(src, { method: 'HEAD' })
        .then((r) => {
          if (r.ok) return;
          return lerMidia(decodeURIComponent(src.slice(PREFIXO_MIDIA.length)), token).then((url) => {
            criadas.push(url);
            botao.dataset.audio = url;
          });
        })
        .catch(() => undefined);
    }
    return () => criadas.forEach((url) => URL.revokeObjectURL(url));
  }, [html, token]);

  // Link para documento que o público não vê: abre no Ateliê.
  const onClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-doc]');
    if (!link) return;
    const doc = link.dataset.doc ?? '';
    if (publicos.has(doc)) return;
    event.preventDefault();
    router.push(rotaNoAtelie(doc));
  };

  if (!token) return <p className="atelie__aviso">Entre no Ateliê para ver o documento inteiro.</p>;
  if (erro) return <p className="editor__estado editor__estado--erro">{erro}</p>;
  if (!html) return <p className="atelie__aviso">Lendo o acervo…</p>;
  return (
    <div className="atelie__folha" ref={folha} onClick={onClick}>
      {/* O HTML sai do pipeline do projeto, com `allowDangerousHtml: false`. */}
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
