import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { getCompendium } from '@/lib/breach/api';
import { PageHead } from '@/components/content';
import { Retrato } from '@/components/mundo/Figura';
import type { Personagem } from '@/lib/breach/mundo';

export const metadata: Metadata = {
  title: 'Personagens',
  description: 'Os Nefandos e seus Deviantes, lado a lado, agrupados pelo reino a que pertencem.',
};

/** Quem tem nome e rosto no acervo, lado a lado, por reino. */
export default async function PersonagensPage() {
  const { personagens, reinos } = await getCompendium();

  const grupos = reinos
    .map((reino) => ({
      reino,
      gente: personagens.filter((p) => p.reinos.includes(reino.path)),
    }))
    .filter((grupo) => grupo.gente.length > 0);
  const semReino: Personagem[] = personagens.filter(
    (p) => !reinos.some((reino) => p.reinos.includes(reino.path)),
  );

  return (
    <div className="stack">
      <PageHead
        eyebrow="Explorar"
        title="Personagens"
        lede="Os Nefandos e os Deviantes que os servem, lado a lado, no reino de cada um."
      />

      {grupos.map(({ reino, gente }) => (
        <section key={reino.path} className="elenco">
          <div className="section-title">
            <h2>{reino.title}</h2>
            <Link href={`/reinos#${reino.id}`}>
              o reino <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <div className="fileira fileira--grande">
            {gente.map((p) => (
              <Retrato key={p.path} item={p} papel={p.papel} />
            ))}
          </div>
        </section>
      ))}

      {semReino.length > 0 ? (
        <section className="elenco">
          <div className="section-title">
            <h2>Sem reino registrado</h2>
          </div>
          <div className="fileira fileira--grande">
            {semReino.map((p) => (
              <Retrato key={p.path} item={p} papel={p.papel} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
