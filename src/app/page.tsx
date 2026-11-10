import Link from 'next/link';
import {
  ArrowRight, BookOpen, Castle, History, Hourglass, Images, Languages, Share2, Users,
} from 'lucide-react';
import { getCompendium, getGeradoEm } from '@/lib/breach/api';
import { EditarLink } from '@/components/EditarLink';
import { AlternarAtelie } from '@/components/atelie/AlternarAtelie';
import { Hero, PageHead } from '@/components/content';
import { ROTA_LINHA_DO_TEMPO } from '@/lib/breach/rotas';

/**
 * Página inicial. Curta de propósito: a abertura do README do acervo, três
 * portas de entrada (por era, por reino, por personagem), as eras em ordem, os
 * reinos, as categorias e a última passagem. O
 * resto — lacunas, contradições, regras — mora no índice e nas convenções.
 */
export default async function HomePage() {
  const compendium = await getCompendium();
  const { readme, reinos, personagens } = compendium;
  const ultima = compendium.changelog[0];
  const geradoEm = await getGeradoEm();
  const publicos = compendium.docs.map((doc) => doc.path);

  return (
    <div className="stack inicio">
      {readme?.hero ? (
        <Hero src={readme.hero} alt={readme.heroAlt ?? 'Vista das montanhas do mundo conhecido, com um dragão em voo'} />
      ) : null}

      <PageHead eyebrow="Acervo de um universo em construção" title={readme?.title ?? 'Compêndio Breach'}>
        <div className="pagehead__acoes">
          <EditarLink path="README.md" />
        </div>
        <AlternarAtelie path="README.md" publicos={publicos} geradoEm={geradoEm}>
          {readme?.introHtml ? (
            <div className="pagehead__lede prose" dangerouslySetInnerHTML={{ __html: readme.introHtml }} />
          ) : null}
        </AlternarAtelie>
      </PageHead>

      <section className="entradas" aria-label="Por onde começar">
        <Link className="entrada entrada--destaque" href={ROTA_LINHA_DO_TEMPO}>
          <Hourglass size={20} aria-hidden="true" />
          <span className="entrada__titulo">Ler em ordem</span>
          <span className="entrada__texto">Da criação à segunda era.</span>
        </Link>
        <Link className="entrada" href="/reinos">
          <Castle size={20} aria-hidden="true" />
          <span className="entrada__titulo">Por reino</span>
          <span className="entrada__texto">{reinos.map((reino) => reino.title).join(' · ')}</span>
        </Link>
        <Link className="entrada" href="/personagens">
          <Users size={20} aria-hidden="true" />
          <span className="entrada__titulo">Por personagem</span>
          <span className="entrada__texto">{personagens.length} Nefandos e Deviantes, lado a lado.</span>
        </Link>
      </section>

      {reinos.length > 0 ? (
        <section id="reinos">
          <div className="section-title">
            <h2>Os reinos</h2>
            <Link href="/reinos">
              todos <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <div className="vitrine">
            {reinos.map((reino) => (
              <Link className="vitrine__item" key={reino.path} href={`/reinos#${reino.id}`}>
                {reino.capa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={reino.capa} alt="" loading="lazy" decoding="async" />
                ) : null}
                <span className="vitrine__nome">{reino.title}</span>
                <span className="vitrine__era">{reino.eras[0]?.titulo ?? reino.subtipo ?? ''}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <nav className="atalhos" aria-label="Mais para explorar">
        <Link href="/galeria">
          <Images size={15} aria-hidden="true" /> Galeria
        </Link>
        <Link href="/relacoes">
          <Share2 size={15} aria-hidden="true" /> Relações
        </Link>
        <Link href="/thalae">
          <Languages size={15} aria-hidden="true" /> Aprender Thalae
        </Link>
        <Link href="/compendio">
          <BookOpen size={15} aria-hidden="true" /> Índice canônico
        </Link>
      </nav>

      <section id="categorias">
        <div className="section-title">
          <h2>Categorias</h2>
        </div>
        <ul className="indice">
          {compendium.categories.map((category) => (
            <li key={category.slug}>
              <Link href={`/c/${category.slug}`}>
                <span className="indice__num">{category.number}</span>
                <span className="indice__nome">{category.title}</span>
                <span className="indice__conta">{category.docs.length || '—'}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {ultima ? (
        <Link className="novidade" href="/alteracoes">
          <History size={15} aria-hidden="true" />
          <span className="novidade__data">{ultima.date}</span>
          <span className="novidade__titulo">{ultima.title}</span>
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ) : null}

    </div>
  );
}
