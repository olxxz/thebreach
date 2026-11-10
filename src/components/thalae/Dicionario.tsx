import { Selo } from './Selo';
import { analisarRaiz, raizBase, type NomeDoAcervo, type RaizDoAcervo } from '@/lib/thalae/raizes';
import { resolverRelativo } from '@/lib/breach/slug';
import { urlDaImagem } from '@/lib/breach/imagens';

const PASTA = '01-cosmologia/thalae';

/** Os nomes do acervo com selo e raízes, e as raízes com os nomes em que entram. */
export function Dicionario({ nomes, raizes }: { nomes: NomeDoAcervo[]; raizes: RaizDoAcervo[] }) {
  const ordenados = [...nomes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const usos = new Map<string, string[]>();
  for (const nome of nomes) {
    for (const escrita of nome.raizes) {
      const base = raizBase(escrita, raizes);
      if (!base) continue;
      usos.set(base.texto, [...(usos.get(base.texto) ?? []), nome.nome]);
    }
  }
  const raizesEmOrdem = [...raizes].sort((a, b) => a.texto.localeCompare(b.texto, 'pt-BR'));

  return (
    <div className="dicionario">
      <ul className="dicionario__nomes">
        {ordenados.map((nome) => (
          <li className="verbete" key={nome.nome}>
            <Selo raizes={nome.raizes.map((r) => analisarRaiz(r))} rotulo={`Selo de ${nome.nome}`} />
            <div>
              <p className="verbete__nome">
                {nome.nome}
                {nome.audio ? (
                  <button
                    type="button"
                    className="pronuncia"
                    data-audio={urlDaImagem(resolverRelativo(PASTA, nome.audio))}
                    aria-label={`Ouvir: ${nome.nome}`}
                  >
                    ouvir
                  </button>
                ) : null}
              </p>
              <p className="verbete__sentido">{nome.sentido}</p>
              <p className="verbete__raizes">
                {nome.raizes.map((escrita, i) => (
                  <span key={`${escrita}-${i}`}>
                    <b>{escrita}</b> {raizBase(escrita, raizes)?.sentido ?? '—'}
                  </span>
                ))}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="dicionario__titulo">Raízes</h3>
      <dl className="dicionario__raizes">
        {raizesEmOrdem.map((raiz) => (
          <div key={raiz.texto}>
            <dt>{raiz.texto}</dt>
            <dd>
              {raiz.sentido}
              {usos.has(raiz.texto) ? <span> · em {[...new Set(usos.get(raiz.texto))].join(', ')}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
