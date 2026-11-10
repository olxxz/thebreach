'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Feather } from 'lucide-react';
import { useAppearance } from '@/components/AppearanceProvider';
import { Crumbs, PageHead } from '@/components/content';
import { EditarLink } from '@/components/EditarLink';
import { listarArvore, lerArquivo } from '@/lib/breach/github';
import { labelFromPath } from '@/lib/breach/slug';
import { rotaNoAtelie, VersaoCompleta } from './VersaoCompleta';

interface Props {
  publicos: string[];
}

/** O título de um documento: a primeira linha `# `. */
function tituloDe(bruto: string, path: string): string {
  return /^#\s+(.+)$/m.exec(bruto)?.[1].trim() ?? labelFromPath(path);
}

/** Grupo de um documento na lista: a pasta de categoria, ou o 00-meta. */
function grupoDe(path: string): string {
  if (path.startsWith('10-propostas/')) return 'Propostas';
  if (path.startsWith('00-meta/')) return 'Bastidores do acervo';
  return 'Só lacunas ou propostas';
}

function Lista({ publicos }: Props) {
  const { token } = useAppearance();
  const [docs, setDocs] = useState<string[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!token) return;
    const conhecidos = new Set(publicos);
    listarArvore(token)
      .then((arvore) => {
        if (!arvore) return setErro('O acervo é grande demais para listar de uma vez.');
        setDocs(
          [...arvore.keys()]
            .filter((p) => p.endsWith('.md') && !conhecidos.has(p) && p !== 'CLAUDE.md' && p !== '00-meta/COFRE.md')
            .sort(),
        );
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : String(e)));
  }, [token, publicos]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const doc of docs ?? []) mapa.set(grupoDe(doc), [...(mapa.get(grupoDe(doc)) ?? []), doc]);
    return [...mapa];
  }, [docs]);

  if (erro) return <p className="editor__estado editor__estado--erro">{erro}</p>;
  if (!docs) return <p className="atelie__aviso">Lendo o acervo…</p>;
  return (
    <div className="atelie__grupos">
      {grupos.map(([grupo, lista]) => (
        <section key={grupo} className="atelie__grupo">
          <h2>{grupo}</h2>
          <ul>
            {lista.map((doc) => (
              <li key={doc}>
                <Link href={rotaNoAtelie(doc)}>{labelFromPath(doc)}</Link>
                <code>{doc}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="atelie__nota">
        Os documentos públicos que têm propostas ou lacunas mostram, no Ateliê, uma faixa no topo com a troca entre a
        página pública e o documento inteiro.
      </p>
    </div>
  );
}

function Documento({ path, publicos }: { path: string; publicos: string[] }) {
  const { token } = useAppearance();
  const [bruto, setBruto] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!token) return;
    lerArquivo(path, token)
      .then((arquivo) => (arquivo ? setBruto(arquivo.conteudo) : setErro(`${path} não existe no acervo.`)))
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : String(e)));
  }, [path, token]);

  return (
    <div>
      <Crumbs trail={[{ href: '/', label: 'Compêndio' }, { href: '/atelie', label: 'Ateliê' }, { label: labelFromPath(path) }]} />
      <PageHead eyebrow={`Ateliê › ${grupoDe(path)}`} title={bruto ? tituloDe(bruto, path) : labelFromPath(path)}>
        <div className="pagehead__acoes">
          <EditarLink path={path} />
        </div>
      </PageHead>
      {erro ? (
        <p className="editor__estado editor__estado--erro">{erro}</p>
      ) : (
        <VersaoCompleta path={path} publicos={new Set(publicos)} bruto={bruto} />
      )}
    </div>
  );
}

function Conteudo({ publicos }: Props) {
  const { admin } = useAppearance();
  const path = useSearchParams().get('d') ?? '';

  if (!admin) {
    return (
      <PageHead eyebrow="Ateliê" title="Ateliê">
        <p className="pagehead__lede">
          O lugar das propostas e das lacunas, que o público não vê. Aperte <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd>{' '}
          ou use <em>Entrar no Ateliê</em>, nas configurações.
        </p>
      </PageHead>
    );
  }
  if (path) return <Documento path={path} publicos={publicos} />;
  return (
    <div>
      <PageHead eyebrow="Ateliê" title="Ateliê">
        <p className="pagehead__lede">
          <Feather size={15} aria-hidden="true" /> O que ainda está sendo trabalhado: propostas, lacunas e os bastidores
          do acervo. Nada daqui vai para o site público.
        </p>
      </PageHead>
      <Lista publicos={publicos} />
    </div>
  );
}

export function PaginaDoAtelie({ publicos }: Props) {
  return (
    <Suspense fallback={<PageHead eyebrow="Ateliê" title="Ateliê" />}>
      <Conteudo publicos={publicos} />
    </Suspense>
  );
}
