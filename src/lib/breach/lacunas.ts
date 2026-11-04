import type { Compendium } from './types';

export type Lacuna = Compendium['priorityGaps'][number];
export type NivelDeImpacto = 'alto' | 'médio' | 'baixo';

const PESO: Record<NivelDeImpacto, number> = { alto: 0, médio: 1, baixo: 2 };

/**
 * O índice escreve o impacto como "médio — bloqueia o mapa do cosmos": um nível
 * e, às vezes, o porquê. Separa os dois.
 */
export function lerImpacto(impacto: string): { nivel: NivelDeImpacto | null; detalhe: string } {
  const [cabeca, ...resto] = impacto.split(/\s+[—–-]\s+/);
  const palavra = (cabeca ?? '').trim().toLowerCase();
  const nivel = palavra in PESO ? (palavra as NivelDeImpacto) : null;
  return { nivel, detalhe: nivel ? resto.join(' — ').trim() : impacto.trim() };
}

/** Do impacto mais alto ao mais baixo; dentro do mesmo nível, a ordem do índice. */
export function ordenarPorImpacto(lacunas: Lacuna[]): Lacuna[] {
  const peso = (lacuna: Lacuna): number => {
    const { nivel } = lerImpacto(lacuna.impacto);
    return nivel ? PESO[nivel] : Object.keys(PESO).length;
  };
  return lacunas
    .map((lacuna, ordem) => ({ lacuna, ordem }))
    .sort((a, b) => peso(a.lacuna) - peso(b.lacuna) || a.ordem - b.ordem)
    .map(({ lacuna }) => lacuna);
}
