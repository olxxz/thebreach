import Link from 'next/link';
import { Hourglass } from 'lucide-react';
import type { Cartao } from '@/lib/breach/mundo';
import { ROTA_LINHA_DO_TEMPO } from '@/lib/breach/rotas';

interface Props {
  antes: Cartao | null;
  depois: Cartao | null;
  posicao: number;
  total: number;
}

function Passo({ item, sentido, classe }: { item: Cartao; sentido: string; classe: string }) {
  return (
    <Link className={`continuar__passo ${classe}`} href={item.href}>
      {item.capa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.capa} alt="" loading="lazy" decoding="async" />
      ) : null}
      <span className="continuar__texto">
        <span className="continuar__sentido">{sentido}</span>
        <span className="continuar__titulo">{item.title}</span>
      </span>
    </Link>
  );
}

/**
 * O documento anterior e o seguinte na ordem da linha do tempo. É o que deixa
 * ler o acervo do começo ao fim sem voltar ao índice a cada página.
 */
export function ContinuarLeitura({ antes, depois, posicao, total }: Props) {
  return (
    <nav className="continuar" aria-label="Ler em ordem">
      <p className="continuar__rotulo">
        <Hourglass size={13} aria-hidden="true" />
        Ler em ordem · {posicao} de {total}
        <Link href={ROTA_LINHA_DO_TEMPO}>linha do tempo</Link>
      </p>
      {antes ? <Passo item={antes} sentido="← Anterior" classe="continuar__passo--antes" /> : null}
      {depois ? <Passo item={depois} sentido="Próximo →" classe="continuar__passo--depois" /> : null}
    </nav>
  );
}
