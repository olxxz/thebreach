'use client';

import { useMemo, useState } from 'react';
import { Hourglass } from 'lucide-react';
import type { NoResumo } from '@/lib/breach/types';
import { DocTree } from './content';

interface Props {
  nodes: NoResumo[];
  eras: Array<{ id: string; titulo: string }>;
}

/** Mantém um galho quando ele, ou alguém dentro dele, é da era escolhida. */
function filtrar(nodes: NoResumo[], era: string): NoResumo[] {
  return nodes.flatMap((node) => {
    const filhos = filtrar(node.children, era);
    if (node.doc.eras.includes(era) || filhos.length > 0) return [{ doc: node.doc, children: filhos }];
    return [];
  });
}

function erasPresentes(nodes: NoResumo[], achadas = new Set<string>()): Set<string> {
  for (const node of nodes) {
    for (const era of node.doc.eras) achadas.add(era);
    erasPresentes(node.children, achadas);
  }
  return achadas;
}

/** Os documentos de uma categoria, com o filtro por era da linha do tempo. */
export function ListaDeDocumentos({ nodes, eras }: Props) {
  const [era, setEra] = useState<string | null>(null);
  const presentes = useMemo(() => {
    const ids = erasPresentes(nodes);
    return eras.filter((e) => ids.has(e.id));
  }, [nodes, eras]);
  const visiveis = useMemo(() => (era ? filtrar(nodes, era) : nodes), [nodes, era]);

  return (
    <>
      {presentes.length > 1 ? (
        <div className="filtros filtros--era" role="group" aria-label="Filtrar por era">
          <span className="filtros__rotulo">
            <Hourglass size={13} aria-hidden="true" /> Era
          </span>
          <button type="button" className="filtro" aria-pressed={era === null} onClick={() => setEra(null)}>
            Todas
          </button>
          {presentes.map((e) => (
            <button
              key={e.id}
              type="button"
              className="filtro"
              aria-pressed={era === e.id}
              onClick={() => setEra(era === e.id ? null : e.id)}
            >
              {e.titulo}
            </button>
          ))}
        </div>
      ) : null}
      {visiveis.length > 0 ? (
        <DocTree nodes={visiveis} />
      ) : (
        <p className="empty">Nenhum documento desta categoria se passa nessa era.</p>
      )}
    </>
  );
}
