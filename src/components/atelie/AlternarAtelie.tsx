'use client';

import { useEffect, useState } from 'react';
import { Feather } from 'lucide-react';
import { useAppearance } from '@/components/AppearanceProvider';
import { lerArquivo } from '@/lib/breach/github';
import { VersaoCompleta } from './VersaoCompleta';

interface Props {
  path: string;
  /** Os documentos que o público vê. */
  publicos: string[];
  /** A página pública, como o build a gerou. */
  children: React.ReactNode;
}

const CHAVE = 'breach:atelie-vista';

function contar(bruto: string): { propostas: number; lacunas: number } {
  let propostas = 0;
  let lacunas = 0;
  for (const [, dentro] of bruto.matchAll(/`\[\s*([^\]`]+?)\s*\]`/g)) {
    const id = dentro.split(/\s*[—–:-]\s*/)[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
    if (id === 'PROPOSTA') propostas += 1;
    if (id === 'LACUNA') lacunas += 1;
  }
  return { propostas, lacunas };
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/**
 * Na página pública, o que o Ateliê acrescenta: uma faixa que diz quanto do
 * documento o público não vê, e a troca entre a página pública e o documento
 * inteiro. Fora do Ateliê não desenha nada além da página.
 */
export function AlternarAtelie({ path, publicos, children }: Props) {
  const { admin, token } = useAppearance();
  const [bruto, setBruto] = useState<string | null>(null);
  const [vista, setVista] = useState<'publico' | 'atelie'>('publico');

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CHAVE) === 'atelie') setVista('atelie');
    } catch {
      /* sem armazenamento: começa na página pública */
    }
  }, []);

  useEffect(() => {
    if (!admin || !token) return;
    let cancelado = false;
    lerArquivo(path, token)
      .then((arquivo) => !cancelado && setBruto(arquivo?.conteudo ?? null))
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [admin, token, path]);

  if (!admin) return <>{children}</>;

  const conta = bruto ? contar(bruto) : null;
  const nada = conta && conta.propostas + conta.lacunas === 0;
  const escolher = (proxima: 'publico' | 'atelie'): void => {
    setVista(proxima);
    try {
      window.localStorage.setItem(CHAVE, proxima);
    } catch {
      /* sem armazenamento: vale só nesta página */
    }
  };

  return (
    <>
      <div className="atelie__faixa" role="group" aria-label="Ateliê">
        <Feather size={15} aria-hidden="true" />
        <span className="atelie__conta">
          {!conta
            ? 'Ateliê: lendo o acervo…'
            : nada
              ? 'Tudo aqui é público.'
              : `O público não vê ${[
                  conta.propostas ? plural(conta.propostas, 'proposta', 'propostas') : '',
                  conta.lacunas ? plural(conta.lacunas, 'lacuna', 'lacunas') : '',
                ]
                  .filter(Boolean)
                  .join(' e ')}.`}
        </span>
        {nada ? null : (
          <span className="atelie__troca">
            <button type="button" aria-pressed={vista === 'publico'} onClick={() => escolher('publico')}>
              Público
            </button>
            <button type="button" aria-pressed={vista === 'atelie'} onClick={() => escolher('atelie')}>
              Ateliê
            </button>
          </span>
        )}
      </div>
      {vista === 'atelie' && !nada ? (
        <VersaoCompleta path={path} publicos={new Set(publicos)} bruto={bruto} />
      ) : (
        children
      )}
    </>
  );
}
