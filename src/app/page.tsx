import Link from 'next/link';
import {
  ArrowRight, BookOpen, Castle, History, Hourglass, Images, Languages, Share2, Users,
} from 'lucide-react';
import { getCompendium } from '@/lib/breach/api';
import { CategoryCard, Hero, MarkerLegend, PageHead } from '@/components/content';
import { FaixaDeEras } from '@/components/LinhaDoTempo';
import { ROTA_LINHA_DO_TEMPO } from '@/lib/breach/rotas';

/**
 * Página inicial. Curta de propósito: a abertura do README do acervo, três
 * portas de entrada (por era, por reino, por personagem), as eras em ordem, os
 * reinos, as categorias e a última passagem. O
 * resto — lacunas, contradições, regras — mora no índice e nas convenções.
 */
export default async function HomePage() {
  const compendium = await getCompendium();
  const { stats, readme, eras, reinos, personagens } = compendium;
  const ultima = compendium.changelog[0];

  return (
    <div className="stack inicio">
      {readme?.hero ? (
        <Hero src={readme.hero} alt={readme.heroAlt ?? 'Vista das montanhas do mundo conhecido, com um dragão em voo'} />
      ) : null}

      <PageHead eyebrow="Acervo de um universo em construção" title={readme?.title ?? 'Compêndio Breach'}>
        {readme?.introHtml ? (
          <div className="pagehead__lede prose" dangerouslySetInnerHTML={{ __html: readme.introHtml }} />
        ) : null}
      </PageHead>

      <section className="entradas" aria-label="Por onde começar">
        <Link className="entrada entrada--destaque" href={ROTA_LINHA_DO_TEMPO}>
          <Hourglass size={20} aria-hidden="true" />
          <span className="entrada__titulo">Ler em ordem</span>
          <span className="entrada__texto">A linha do tempo, da criação à segunda era, com os documentos de cada era.</span>
        </Link>
        <Link className="entrada" href="/reinos">
          <Castle size={20} aria-hidden="true" />
          <span className="entrada__titulo">Por reino</span>
          <span className="entrada__texto">
            {reinos.map((reino) => reino.title).join(', ')}: quem governa, os lugares e os segredos de cada um.
          </span>
        </Link>
        <Link className="entrada" href="/personagens">
          <Users size={20} aria-hidden="true" />
          <span className="entrada__titulo">Por personagem</span>
          <span className="entrada__texto">
            Os {personagens.length} Nefandos e Deviantes com rosto no acervo, lado a lado.
          </span>
        </Link>
      </section>

      {eras.length > 0 ? (
        <section id="eras">
          <div className="section-title">
            <h2>As eras</h2>
            <Link href={ROTA_LINHA_DO_TEMPO}>
              linha do tempo <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <FaixaDeEras eras={eras} />
        </section>
      ) : null}

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
        <div className="grid">
          {compendium.categories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </section>

      {ultima ? (
        <Link className="novidade" href="/alteracoes">
          <History size={15} aria-hidden="true" />
          <span className="novidade__data">{ultima.date}</span>
          <span className="novidade__titulo">{ultima.title}</span>
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ) : null}

      <details className="panel leitura">
        <summary>Como ler os marcadores</summary>
        <p className="card__text panel__lede">
          Toda afirmação traz a camada de onde vem: o que é verdade no mundo e o que os povos acreditam. Sem marcador,
          a afirmação não conta como documentada. As regras completas estão nas{' '}
          <Link href="/convencoes">convenções</Link>.
        </p>
        <MarkerLegend />
      </details>

      <p className="inicio__rodape">
        {stats.docs} documentos · {stats.categories} categorias · {stats.markers.CANONICO ?? 0} afirmações canônicas
        {stats.updatedAt ? ` · atualizado em ${stats.updatedAt}` : ''}
      </p>
    </div>
  );
}
