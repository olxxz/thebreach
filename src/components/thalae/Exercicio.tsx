'use client';

import { useState } from 'react';
import { Selo } from './Selo';
import type { Palavra } from '@/lib/thalae/palavras';

/** Um selo para ler sozinho; a resposta só aparece quando pedida. */
export function Exercicio({ palavra }: { palavra: Palavra }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="exercicio">
      <Selo raizes={palavra.raizes} caido={palavra.caido} rotulo="Selo do exercício" />
      <div className="exercicio__texto">
        <p>
          Quantos anéis ele tem? Qual a vogal de cada arco? Há alguma marca sobre o segundo arco? O selo está
          rachado?
        </p>
        <button type="button" className="leitor__passo" aria-expanded={aberta} onClick={() => setAberta(!aberta)}>
          {aberta ? 'Esconder a resposta' : 'Ver a resposta'}
        </button>
        {aberta ? (
          <p className="exercicio__resposta">
            Dois anéis: um arco de 300° sem marcas (<b>a-</b>, &quot;aquele que…&quot;) e um de 100° com uma
            corcova para fora (<b>lu</b>, &quot;ver&quot;). Sem fratura. <b>{palavra.transcricao}</b> —{' '}
            {palavra.sentido}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
