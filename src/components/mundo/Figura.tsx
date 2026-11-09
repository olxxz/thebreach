import Link from 'next/link';
import { FileText } from 'lucide-react';
import type { Cartao } from '@/lib/breach/mundo';
import { accentFor } from '@/lib/layouts';

/** Um documento como miniatura com nome: a peça das fileiras de um reino. */
export function Figura({ item, rotulo }: { item: Cartao; rotulo?: string }) {
  return (
    <Link
      className="figura"
      href={item.href}
      style={{ ['--card-accent' as string]: accentFor(item.categorySlug) }}
    >
      {item.capa ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="figura__img" src={item.capa} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="figura__img figura__img--vazia" aria-hidden="true">
          <FileText size={18} />
        </span>
      )}
      <span className="figura__texto">
        <span className="figura__nome">{item.title}</span>
        {rotulo ?? item.subtipo ? <span className="figura__papel">{rotulo ?? item.subtipo}</span> : null}
      </span>
    </Link>
  );
}

/** Retrato de corpo inteiro, para as fileiras de personagens. */
export function Retrato({ item, papel }: { item: Cartao; papel?: string }) {
  return (
    <Link className="retrato" href={item.href}>
      <span className="retrato__quadro">
        {item.capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.capa} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="retrato__vazio" aria-hidden="true">sem retrato</span>
        )}
      </span>
      <span className="retrato__nome">{item.title}</span>
      {papel ? <span className="retrato__papel">{papel}</span> : null}
    </Link>
  );
}
