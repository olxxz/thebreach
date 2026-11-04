/** Uma entidade na navegação, com as entidades contidas nela. */
export interface NavDoc {
  slug: string;
  title: string;
  children: NavDoc[];
}

export interface NavCategory {
  slug: string;
  number: string;
  title: string;
  count: number;
  docs: NavDoc[];
}

/**
 * Caminhos que precisam estar abertos para que a página atual apareça na
 * árvore: `/c/bestiario`, `/c/bestiario/dragoes`, e assim por diante.
 */
export function ancestrais(pathname: string): string[] {
  const partes = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (partes[0] !== 'c') return [];
  const saida: string[] = [];
  for (let i = 2; i <= partes.length; i += 1) saida.push(`/${partes.slice(0, i).join('/')}`);
  return saida;
}

/**
 * Onde a linha da árvore está em relação à página aberta: ela mesma, ou um
 * galho que contém a página. Marcar só a igualdade exata deixava a árvore muda
 * dentro de qualquer subpágina.
 */
export type Estado = 'atual' | 'caminho' | undefined;

export function estadoDe(pathname: string, href: string): Estado {
  const aqui = pathname.replace(/\/+$/, '');
  if (aqui === href) return 'atual';
  if (aqui.startsWith(`${href}/`)) return 'caminho';
  return undefined;
}
