/**
 * Onde mora o acervo. Fonte única para o build (que pode sobrescrever por
 * variável de ambiente, em `source.ts`) e para o navegador (Ateliê
 * e textos da interface).
 */
export const REPOSITORIO = {
  owner: 'olxxz',
  repo: 'breach',
  ref: 'main',
} as const;

/** `dono/repositório`, como aparece nos textos da interface. */
export const NOME_REPOSITORIO = `${REPOSITORIO.owner}/${REPOSITORIO.repo}`;
