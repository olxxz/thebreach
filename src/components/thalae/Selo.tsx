import { quadroDoSelo, tracarSelo, type Raiz } from '@/lib/thalae/selo';

/**
 * Um selo da Thalae em SVG. Com `anelAtivo`, os outros anéis esmaecem — é
 * assim que o leitor acompanha a leitura do centro para fora.
 */
export function Selo({
  raizes,
  caido = false,
  anelAtivo = null,
  rotulo,
}: {
  raizes: Raiz[];
  caido?: boolean;
  anelAtivo?: number | null;
  rotulo: string;
}) {
  const tracos = tracarSelo(raizes, caido);
  const esmaecido = (anel: number): boolean => anelAtivo !== null && anel !== -1 && anel !== anelAtivo;

  return (
    <svg className="selo" viewBox={quadroDoSelo(raizes.length)} role="img" aria-label={rotulo}>
      {tracos.map((t, i) => {
        const opacidade = esmaecido(t.anel) ? 0.18 : 1;
        if (t.fratura) {
          return (
            <g key={i}>
              <path d={t.d} className="selo__papel" strokeWidth={t.largura} fill="none" strokeLinejoin="bevel" />
              <path d={t.d} className="selo__tinta" strokeWidth={1.1} fill="none" strokeLinejoin="bevel" />
            </g>
          );
        }
        if (t.tipo === 'circle') {
          return (
            <circle
              key={i}
              cx={t.cx}
              cy={t.cy}
              r={t.r}
              className={t.cheio ? 'selo__cheio' : 'selo__tinta'}
              strokeWidth={t.largura}
              opacity={opacidade}
            />
          );
        }
        return (
          <path key={i} d={t.d} className="selo__tinta" strokeWidth={t.largura} fill="none" strokeLinecap="round" opacity={opacidade} />
        );
      })}
    </svg>
  );
}
