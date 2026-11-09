/**
 * A linha do tempo do acervo.
 *
 * A cronologia mora no acervo, em `06-historia/linha-do-tempo/`: a seção
 * "As eras" tem uma subseção por era, com os fatos marcados e uma linha
 * `**Documentos:**` que lista, por caminho, o que se passa naquela era. O site
 * lê isso para desenhar a página da linha do tempo e para mostrar, em cada
 * documento, a era em que ele se passa.
 */

import { renderMarkdown, type Titulos } from './markdown';
import { normalizeDocPath, slugify } from './slug';
import { CAMINHO_LINHA_DO_TEMPO, ROTA_LINHA_DO_TEMPO } from './rotas';

export { CAMINHO_LINHA_DO_TEMPO };

export interface Era {
  /** Âncora da era na página da linha do tempo. */
  id: string;
  /** Posição na ordem do acervo, ex.: `2.5`. */
  numero: string;
  titulo: string;
  /** Os fatos da era, já em HTML. */
  html: string;
  /** Caminhos dos documentos que se passam na era, na ordem do acervo. */
  documentos: string[];
}

/** O que uma página precisa saber da era: nome e onde ela está na linha do tempo. */
export interface EraRef {
  id: string;
  titulo: string;
  href: string;
}

const LINHA_DOCUMENTOS = /^\*\*Documentos:\*\*\s*(.*)$/;

/** Lê as eras da seção "As eras" do documento da linha do tempo. */
export async function lerLinhaDoTempo(markdown: string, titulos?: Titulos): Promise<Era[]> {
  const linhas = markdown.split('\n');
  const inicio = linhas.findIndex((linha) => /^##\s+(\d+\.\s+)?As eras\s*$/i.test(linha));
  if (inicio === -1) return [];

  const eras: Era[] = [];
  let atual: { numero: string; titulo: string; corpo: string[]; documentos: string[] } | null = null;

  const fechar = async (): Promise<void> => {
    if (!atual) return;
    eras.push({
      id: `era-${slugify(atual.titulo)}`,
      numero: atual.numero,
      titulo: atual.titulo,
      html: await renderMarkdown(atual.corpo.join('\n').trim(), CAMINHO_LINHA_DO_TEMPO, titulos),
      documentos: atual.documentos,
    });
  };

  for (const linha of linhas.slice(inicio + 1)) {
    if (/^##\s+/.test(linha)) break;
    const subtitulo = /^###\s+(?:(\d+(?:\.\d+)*)\.?\s+)?(.*)$/.exec(linha);
    if (subtitulo) {
      await fechar();
      atual = { numero: subtitulo[1] ?? '', titulo: subtitulo[2].trim(), corpo: [], documentos: [] };
      continue;
    }
    if (!atual) continue;
    const docs = LINHA_DOCUMENTOS.exec(linha.trim());
    if (docs) {
      for (const [, caminho] of docs[1].matchAll(/`([^`]+)`/g)) {
        atual.documentos.push(normalizeDocPath(caminho));
      }
      continue;
    }
    atual.corpo.push(linha);
  }
  await fechar();
  return eras;
}

/** Para cada documento, as eras em que ele aparece. */
export function erasPorDocumento(eras: Era[]): Map<string, EraRef[]> {
  const rota = ROTA_LINHA_DO_TEMPO;
  const mapa = new Map<string, EraRef[]>();
  for (const era of eras) {
    for (const caminho of era.documentos) {
      const lista = mapa.get(caminho) ?? [];
      if (!lista.some((ref) => ref.id === era.id)) {
        lista.push({ id: era.id, titulo: era.titulo, href: `${rota}#${era.id}` });
      }
      mapa.set(caminho, lista);
    }
  }
  return mapa;
}
