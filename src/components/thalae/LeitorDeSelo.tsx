'use client';

import { useState } from 'react';
import { Selo } from './Selo';
import { audioDaThalae, lerAnel, type Palavra } from '@/lib/thalae/palavras';

/** Lê um selo anel por anel, do centro para fora, explicando cada traço. */
export function LeitorDeSelo({ palavras }: { palavras: Palavra[] }) {
  const [id, setId] = useState(palavras[0].id);
  const [anel, setAnel] = useState(0);
  const palavra = palavras.find((p) => p.id === id) ?? palavras[0];
  const raiz = palavra.raizes[anel];
  const ultimo = palavra.raizes.length - 1;

  const escolher = (novo: string): void => {
    setId(novo);
    setAnel(0);
  };

  return (
    <div className="leitor">
      <div className="leitor__escolha" role="group" aria-label="Selo para ler">
        {palavras.map((p) => (
          <button
            key={p.id}
            type="button"
            className="leitor__palavra"
            aria-pressed={p.id === palavra.id}
            onClick={() => escolher(p.id)}
          >
            {p.nome}
          </button>
        ))}
      </div>

      <div className="leitor__corpo">
        <Selo
          raizes={palavra.raizes}
          caido={palavra.caido}
          anelAtivo={anel}
          rotulo={`Selo de ${palavra.nome}, anel ${anel + 1} de ${palavra.raizes.length}`}
        />

        <div className="leitor__texto" aria-live="polite">
          <p className="leitor__contagem">
            Anel {anel + 1} de {palavra.raizes.length}
            {palavra.caido ? ' · selo rachado: um caído' : ''}
          </p>
          <p className="leitor__raiz">
            {raiz.texto} <span>— {raiz.sentido}</span>
          </p>
          <ul className="leitor__regras">
            {lerAnel(raiz).map((linha) => (
              <li key={linha}>{linha}</li>
            ))}
          </ul>
          <div className="leitor__passos">
            <button type="button" className="leitor__passo" disabled={anel === 0} onClick={() => setAnel(anel - 1)}>
              ← Anel anterior
            </button>
            <button type="button" className="leitor__passo" disabled={anel === ultimo} onClick={() => setAnel(anel + 1)}>
              Próximo anel →
            </button>
          </div>
          {anel === ultimo ? (
            <p className="leitor__inteiro">
              Nome inteiro: <b>{palavra.transcricao}</b> — {palavra.sentido}.{' '}
              {palavra.audio ? (
                <button type="button" className="pronuncia" data-audio={audioDaThalae(palavra.audio)}>
                  ouvir
                </button>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
