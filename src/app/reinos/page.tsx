import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Hourglass } from 'lucide-react';
import { getCompendium } from '@/lib/breach/api';
import { PageHead } from '@/components/content';
import { Figura, Retrato } from '@/components/mundo/Figura';

export const metadata: Metadata = {
  title: 'Reinos',
  description: 'Cada reino do acervo com quem o governa, seus lugares, segredos, artefatos e criaturas.',
};

/**
 * O acervo por reino. Cada bloco junta o que os documentos espalham por
 * categoria: quem governa, os lugares, o segredo, os artefatos. Nada é escrito
 * aqui — tudo vem das referências entre os documentos.
 */
export default async function ReinosPage() {
  const { reinos } = await getCompendium();

  return (
    <div className="stack">
      <PageHead
        eyebrow="Explorar"
        title="Reinos"
        lede="Os impérios e países registrados, na ordem da linha do tempo. Cada um com quem o governa, os lugares, os segredos e o que saiu dali."
      >
        <nav className="faixa-eras" aria-label="Reinos">
          <ol>
            {reinos.map((reino) => (
              <li key={reino.path}>
                <a href={`#${reino.id}`}>{reino.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      </PageHead>

      {reinos.map((reino) => {
        const governo = reino.grupos.find((grupo) => grupo.id === 'governo');
        const demais = reino.grupos.filter((grupo) => grupo.id !== 'governo');
        return (
          <section className="reino" id={reino.id} key={reino.path}>
            <Link className="reino__capa" href={reino.href} aria-hidden="true" tabIndex={-1}>
              {reino.capa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={reino.capa} alt="" loading="lazy" decoding="async" />
              ) : null}
            </Link>
            <div className="reino__corpo">
              <div className="reino__cabeca">
                <p className="pagehead__eyebrow">
                  {reino.subtipo ?? 'reino'}
                  {reino.eras.map((era) => (
                    <Link className="chip chip--era" key={era.id} href={era.href}>
                      <Hourglass size={12} aria-hidden="true" />
                      <span>{era.titulo}</span>
                    </Link>
                  ))}
                </p>
                <h2 className="reino__titulo">
                  <Link href={reino.href}>{reino.title}</Link>
                </h2>
                <p className="reino__texto">{reino.excerpt}</p>
                <Link className="reino__abrir" href={reino.href}>
                  Abrir o documento <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>

              {governo ? (
                <div className="reino__grupo">
                  <h3 className="reino__rotulo">{governo.titulo}</h3>
                  <div className="fileira">
                    {governo.itens.map((item) => (
                      <Retrato key={item.path} item={item} papel={item.subtipo ?? undefined} />
                    ))}
                  </div>
                </div>
              ) : null}

              {demais.map((grupo) => (
                <div className="reino__grupo" key={grupo.id}>
                  <h3 className="reino__rotulo">{grupo.titulo}</h3>
                  <div className="figuras">
                    {grupo.itens.map((item) => (
                      <Figura key={item.path} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
