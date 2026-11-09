'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Selo } from './Selo';
import { analisarRaiz, type RaizDoAcervo } from '@/lib/thalae/raizes';

interface Elo {
  /** A raiz como o acervo a lista, sem marcas de som. */
  base: string;
  sentido: string;
  tom: 'nenhum' | 'sobe' | 'desce';
  inspirado: boolean;
  longa: boolean;
}

const MAXIMO = 7;

const AGUDO: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
const GRAVE: Record<string, string> = { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' };

/** A raiz com as marcas de som escolhidas, na transcrição do acervo (§2). */
function escrever(elo: Elo): string {
  let texto = elo.base.replace(/-$/, '');
  const i = [...texto].findIndex((letra) => 'aeiou'.includes(letra));
  if (i !== -1) {
    const letras = [...texto];
    const vogal = letras[i];
    // Vogal longa é vogal dobrada; o tom vai na primeira.
    if (elo.longa && letras[i + 1] !== vogal) letras.splice(i + 1, 0, vogal);
    if (elo.tom === 'sobe') letras[i] = AGUDO[vogal];
    if (elo.tom === 'desce') letras[i] = GRAVE[vogal];
    texto = letras.join('');
  }
  return `${elo.inspirado ? '’' : ''}${texto}`;
}

/** O que o acervo diz do tamanho de um nome (`01-cosmologia/thalae/` §3). */
function escalao(n: number): string {
  if (n === 0) return '';
  if (n === 1) return 'Uma raiz só: um fragmento, o pedaço que um caído entrega.';
  if (n <= 3) return 'Duas ou três raízes: nome de um caído menor.';
  if (n === 4) return 'Quatro raízes: entre o caído menor e o Nefando.';
  return 'De cinco a sete raízes: nome do tamanho do de um Nefando.';
}

/**
 * Oficina de nomes: escolha raízes, em ordem, e veja o selo, a transcrição e
 * o sentido de cada anel. As raízes vêm da tabela do acervo.
 */
export function Oficina({ raizes }: { raizes: RaizDoAcervo[] }) {
  const [elos, setElos] = useState<Elo[]>([]);
  const [ativo, setAtivo] = useState<number | null>(null);
  const [caido, setCaido] = useState(false);

  const grupos = useMemo(() => {
    const mapa = new Map<string, RaizDoAcervo[]>();
    for (const raiz of raizes) {
      const lista = mapa.get(raiz.grupo) ?? [];
      lista.push(raiz);
      mapa.set(raiz.grupo, lista);
    }
    return [...mapa.entries()];
  }, [raizes]);

  const lidas = useMemo(() => elos.map((elo) => analisarRaiz(escrever(elo), elo.sentido)), [elos]);
  const nome = elos.map(escrever).join('-');
  const cheio = elos.length >= MAXIMO;

  const juntar = (raiz: RaizDoAcervo): void => {
    if (cheio) return;
    setElos((atual) => [
      ...atual,
      { base: raiz.texto, sentido: raiz.sentido, tom: 'nenhum', inspirado: false, longa: false },
    ]);
    setAtivo(elos.length);
  };

  const mudar = (i: number, parte: Partial<Elo>): void => {
    setElos((atual) => atual.map((elo, k) => (k === i ? { ...elo, ...parte } : elo)));
  };

  const mover = (i: number, passo: number): void => {
    const j = i + passo;
    if (j < 0 || j >= elos.length) return;
    setElos((atual) => {
      const novo = [...atual];
      [novo[i], novo[j]] = [novo[j], novo[i]];
      return novo;
    });
    setAtivo(j);
  };

  const tirar = (i: number): void => {
    setElos((atual) => atual.filter((_, k) => k !== i));
    setAtivo(null);
  };

  const escolhido = ativo !== null ? elos[ativo] : null;

  return (
    <div className="oficina">
      <div className="oficina__raizes">
        {grupos.map(([grupo, lista]) => (
          <div key={grupo}>
            <p className="oficina__grupo">{grupo}</p>
            <div className="oficina__lista">
              {lista.map((raiz) => (
                <button
                  key={raiz.texto}
                  type="button"
                  className="oficina__raiz"
                  onClick={() => juntar(raiz)}
                  disabled={cheio}
                  title={raiz.sentido}
                >
                  <b>{raiz.texto}</b>
                  <span>{raiz.sentido}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="oficina__mesa">
        {elos.length === 0 ? (
          <p className="oficina__vazio">Toque nas raízes, na ordem do nome. O selo se desenha do centro para fora.</p>
        ) : (
          <>
            <Selo
              raizes={lidas}
              caido={caido}
              anelAtivo={ativo}
              rotulo={`Selo de ${nome}`}
            />
            <p className="oficina__nome" aria-live="polite">
              {nome}
            </p>

            <ol className="oficina__cadeia">
              {elos.map((elo, i) => (
                <li key={`${elo.base}-${i}`}>
                  <button
                    type="button"
                    className="oficina__elo"
                    aria-pressed={ativo === i}
                    onClick={() => setAtivo(ativo === i ? null : i)}
                  >
                    <b>{escrever(elo)}</b>
                    <span>{elo.sentido}</span>
                  </button>
                </li>
              ))}
            </ol>

            {escolhido && ativo !== null ? (
              <div className="oficina__ajuste">
                <p className="oficina__grupo">
                  Anel {ativo + 1}: {escrever(escolhido)}
                </p>
                <div className="filtros">
                  {(['nenhum', 'sobe', 'desce'] as const).map((tom) => (
                    <button
                      key={tom}
                      type="button"
                      className="filtro"
                      aria-pressed={escolhido.tom === tom}
                      onClick={() => mudar(ativo, { tom })}
                    >
                      {tom === 'nenhum' ? 'Sem tom' : tom === 'sobe' ? 'Tom sobe' : 'Tom desce'}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="filtro"
                    aria-pressed={escolhido.inspirado}
                    onClick={() => mudar(ativo, { inspirado: !escolhido.inspirado })}
                  >
                    Som inspirado
                  </button>
                  <button
                    type="button"
                    className="filtro"
                    aria-pressed={escolhido.longa}
                    onClick={() => mudar(ativo, { longa: !escolhido.longa })}
                  >
                    Vogal longa
                  </button>
                </div>
                <div className="filtros">
                  <button type="button" className="filtro" onClick={() => mover(ativo, -1)} disabled={ativo === 0}>
                    <ArrowLeft size={13} aria-hidden="true" /> Para dentro
                  </button>
                  <button
                    type="button"
                    className="filtro"
                    onClick={() => mover(ativo, 1)}
                    disabled={ativo === elos.length - 1}
                  >
                    Para fora <ArrowRight size={13} aria-hidden="true" />
                  </button>
                  <button type="button" className="filtro" onClick={() => tirar(ativo)}>
                    <X size={13} aria-hidden="true" /> Tirar
                  </button>
                </div>
              </div>
            ) : null}

            <div className="filtros">
              <button type="button" className="filtro" aria-pressed={caido} onClick={() => setCaido((v) => !v)}>
                Caído: racha o selo
              </button>
              <button
                type="button"
                className="filtro"
                onClick={() => {
                  setElos([]);
                  setAtivo(null);
                }}
              >
                Recomeçar
              </button>
            </div>

            <p className="oficina__nota">
              {escalao(elos.length)}
              {cheio ? ' Sete é o nome mais longo registrado.' : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
