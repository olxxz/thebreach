'use client';

import { useEffect, useState } from 'react';
import { Clock, Feather } from 'lucide-react';
import { useAppearance } from '@/components/AppearanceProvider';
import { lerArquivo } from '@/lib/breach/github';
import { EVENTO_GRAVADOS, esquecerGravado, haQuantoTempo, lerGravado, type Gravado } from '@/lib/breach/recentes';
import { VersaoCompleta } from './VersaoCompleta';

interface Props {
  path: string;
  /** Os documentos que o público vê. */
  publicos: string[];
  /** Instante em que este site foi construído. */
  geradoEm: string;
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
 * O que o Ateliê acrescenta a uma página do site.
 *
 * - **Provisório.** O que foi gravado neste navegador e o site ainda não
 *   publicou toma o lugar da página antiga — guardado no navegador, some
 *   sozinho quando a publicação alcançar.
 * - **Público / Ateliê.** A troca entre o que o público verá e o documento
 *   inteiro, com propostas e lacunas.
 *
 * Fora do Ateliê não desenha nada além da página.
 */
export function AlternarAtelie({ path, publicos, geradoEm, children }: Props) {
  const { admin, token } = useAppearance();
  const [bruto, setBruto] = useState<string | null>(null);
  const [gravado, setGravado] = useState<Gravado | null>(null);
  const [vista, setVista] = useState<'publico' | 'atelie'>('publico');

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CHAVE) === 'atelie') setVista('atelie');
    } catch {
      /* sem armazenamento: começa na página pública */
    }
  }, []);

  // Só depois da montagem: `localStorage` não existe na geração do site.
  useEffect(() => {
    if (!admin) return;
    const ler = (): void => setGravado(lerGravado(path, geradoEm));
    ler();
    window.addEventListener(EVENTO_GRAVADOS, ler);
    return () => window.removeEventListener(EVENTO_GRAVADOS, ler);
  }, [admin, path, geradoEm]);

  useEffect(() => {
    if (!admin || !token || gravado) return;
    let cancelado = false;
    lerArquivo(path, token)
      .then((arquivo) => !cancelado && setBruto(arquivo?.conteudo ?? null))
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [admin, token, path, gravado]);

  if (!admin) return <>{children}</>;

  const texto = gravado?.conteudo ?? bruto;
  const conta = texto ? contar(texto) : null;
  const semAtelie = conta !== null && conta.propostas + conta.lacunas === 0;
  const escolher = (proxima: 'publico' | 'atelie'): void => {
    setVista(proxima);
    try {
      window.localStorage.setItem(CHAVE, proxima);
    } catch {
      /* sem armazenamento: vale só nesta página */
    }
  };
  const mostraTroca = gravado ? !semAtelie : conta !== null && !semAtelie;

  const troca = mostraTroca ? (
    <span className="atelie__troca">
      <button type="button" aria-pressed={vista === 'publico'} onClick={() => escolher('publico')}>
        Público
      </button>
      <button type="button" aria-pressed={vista === 'atelie'} onClick={() => escolher('atelie')}>
        Ateliê
      </button>
    </span>
  ) : null;

  return (
    <>
      {gravado ? (
        <div className="atelie__faixa atelie__faixa--provisorio" role="group" aria-label="Versão provisória">
          <Clock size={15} aria-hidden="true" />
          <span className="atelie__conta">
            <strong>Provisório.</strong> Você gravou {gravado.novo ? 'este documento novo' : 'esta página'}{' '}
            {haQuantoTempo(gravado.em)}; o site ainda não publicou. Até lá, este navegador mostra o que você gravou.
          </span>
          {troca}
          {gravado.commitUrl ? (
            <a className="atelie__link" href={gravado.commitUrl} target="_blank" rel="noreferrer">
              Ver o commit
            </a>
          ) : null}
          <button
            type="button"
            className="atelie__link"
            onClick={() => {
              esquecerGravado(path);
              setGravado(null);
            }}
          >
            Dispensar
          </button>
        </div>
      ) : (
        <div className="atelie__faixa" role="group" aria-label="Ateliê">
          <Feather size={15} aria-hidden="true" />
          <span className="atelie__conta">
            {!conta
              ? 'Ateliê: lendo o acervo…'
              : semAtelie
                ? 'Tudo aqui é público.'
                : `O público não vê ${[
                    conta.propostas ? plural(conta.propostas, 'proposta', 'propostas') : '',
                    conta.lacunas ? plural(conta.lacunas, 'lacuna', 'lacunas') : '',
                  ]
                    .filter(Boolean)
                    .join(' e ')}.`}
          </span>
          {troca}
        </div>
      )}

      {gravado ? (
        <VersaoCompleta
          path={path}
          publicos={new Set(publicos)}
          bruto={gravado.conteudo}
          publico={vista === 'publico' || semAtelie}
        />
      ) : vista === 'atelie' && conta && !semAtelie ? (
        <VersaoCompleta path={path} publicos={new Set(publicos)} bruto={bruto} />
      ) : (
        children
      )}
    </>
  );
}
