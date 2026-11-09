import Link from 'next/link';
import { FileText } from 'lucide-react';
import type { BreachCategory, BreachDoc } from '@/lib/breach/types';
import type { Era } from '@/lib/breach/linhaDoTempo';
import { ROTA_LINHA_DO_TEMPO } from '@/lib/breach/rotas';
import { accentFor } from '@/lib/layouts';

/**
 * Faixa com as eras em ordem, cada uma levando ao seu trecho da linha do
 * tempo. Serve de mapa rápido: mostra de relance que Savréa é da era dos
 * Nefandos e Nazur, da segunda era.
 */
export function FaixaDeEras({ eras, naPropriaPagina = false }: { eras: Era[]; naPropriaPagina?: boolean }) {
  if (eras.length === 0) return null;
  return (
    <nav className="faixa-eras" aria-label="Eras">
      <ol>
        {eras.map((era, i) => (
          <li key={era.id}>
            <Link href={naPropriaPagina ? `#${era.id}` : `${ROTA_LINHA_DO_TEMPO}#${era.id}`}>
              <span className="faixa-eras__n">{i + 1}</span>
              {era.titulo}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * A linha do tempo: as eras numa coluna, cada uma com os fatos registrados e
 * os documentos que se passam nela.
 */
export function LinhaDoTempo({
  eras,
  docs,
  categories,
}: {
  eras: Era[];
  docs: BreachDoc[];
  categories: BreachCategory[];
}) {
  const porCaminho = new Map(docs.map((doc) => [doc.path, doc]));
  const tituloDaCategoria = new Map(categories.map((category) => [category.slug, category.title]));

  return (
    <ol className="eras">
      {eras.map((era, i) => {
        const daEra = era.documentos
          .map((caminho) => porCaminho.get(caminho))
          .filter((doc): doc is BreachDoc => Boolean(doc));
        return (
          <li className="era" id={era.id} key={era.id}>
            <span className="era__marca" aria-hidden="true">
              {i + 1}
            </span>
            <div className="era__corpo">
              <h2 className="era__titulo">{era.titulo}</h2>
              {era.html ? <div className="prose era__fatos" dangerouslySetInnerHTML={{ __html: era.html }} /> : null}
              {daEra.length > 0 ? (
                <details className="era__docs" open={daEra.length <= 8}>
                  <summary>
                    {daEra.length} documento{daEra.length > 1 ? 's' : ''} desta era
                  </summary>
                  <ul className="era__lista">
                    {daEra.map((doc) => (
                      <li key={doc.path}>
                        <Link
                          className="era__doc"
                          href={`/c/${doc.categorySlug}/${doc.slug}`}
                          style={{ ['--card-accent' as string]: accentFor(doc.categorySlug) }}
                        >
                          {doc.capa ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={doc.capa} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <span className="era__doc-vazio" aria-hidden="true">
                              <FileText size={16} />
                            </span>
                          )}
                          <span className="era__doc-texto">
                            <span className="era__doc-titulo">{doc.title}</span>
                            <span className="era__doc-cat">{tituloDaCategoria.get(doc.categorySlug) ?? ''}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
