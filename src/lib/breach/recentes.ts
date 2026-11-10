/**
 * O que foi gravado neste navegador e o site ainda não sabe.
 *
 * O site é estático: entre o commit e a página no ar existe o fluxo de aviso,
 * a reconstrução e a publicação — um minuto, com sorte. Nesse intervalo a
 * página de leitura mostra a versão anterior, e quem acabou de escrever tem
 * toda razão de achar que não gravou.
 *
 * Isto guarda o que foi gravado para o próprio navegador que gravou poder ver.
 * Não é cache do site nem chega a outra pessoa: some no dia em que a versão
 * publicada alcançar o que está aqui.
 */

const PREFIXO = 'breach:gravado';
/** A lista dos caminhos gravados, para a navegação e a busca saberem de todos. */
const INDICE = 'breach:gravados';
/** Avisado a cada mudança, para a navegação se redesenhar sem recarregar. */
export const EVENTO_GRAVADOS = 'breach:gravados-mudou';

export interface Gravado {
  conteudo: string;
  /** Quando foi gravado, em milissegundos. */
  em: number;
  commitUrl: string;
  /** Documento criado agora: ainda não tem página no site. */
  novo?: boolean;
}

function chave(path: string): string {
  return `${PREFIXO}:${path}`;
}

function lerIndice(): string[] {
  try {
    const valor = JSON.parse(window.localStorage.getItem(INDICE) ?? '[]') as unknown;
    return Array.isArray(valor) ? valor.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

function gravarIndice(caminhos: string[]): void {
  try {
    window.localStorage.setItem(INDICE, JSON.stringify([...new Set(caminhos)]));
  } catch {
    /* sem armazenamento: a página do documento ainda funciona */
  }
  window.dispatchEvent(new Event(EVENTO_GRAVADOS));
}

export function registrarGravado(path: string, gravado: Gravado): void {
  try {
    // Gravar de novo um documento criado agora não o torna velho.
    const anterior = window.localStorage.getItem(chave(path));
    const eraNovo = anterior ? Boolean((JSON.parse(anterior) as Partial<Gravado>).novo) : false;
    window.localStorage.setItem(chave(path), JSON.stringify({ ...gravado, novo: gravado.novo || eraNovo }));
  } catch {
    /* navegação privada ou cota cheia: sem aviso, o site continua certo */
  }
  gravarIndice([...lerIndice(), path]);
}

export function esquecerGravado(path: string): void {
  try {
    window.localStorage.removeItem(chave(path));
  } catch {
    /* nada guardado, nada a apagar */
  }
  gravarIndice(lerIndice().filter((p) => p !== path));
}

/** Tudo o que foi gravado aqui e o site ainda não publicou. */
export function listarGravados(geradoEm: string): Array<{ path: string; gravado: Gravado }> {
  const lista: Array<{ path: string; gravado: Gravado }> = [];
  for (const path of lerIndice()) {
    const gravado = lerGravado(path, geradoEm);
    if (gravado) lista.push({ path, gravado });
  }
  return lista.sort((a, b) => b.gravado.em - a.gravado.em);
}

/** O título de um markdown: a primeira linha `# `. */
export function tituloDoGravado(conteudo: string, path: string): string {
  return /^#\s+(.+)$/m.exec(conteudo)?.[1].trim() ?? path.split('/').filter((p) => p && p !== 'README.md').pop() ?? path;
}

/**
 * O que foi gravado aqui e ainda não está publicado.
 *
 * `geradoEm` é o instante em que o site foi construído. Gravação anterior a
 * ele já está no ar: some sozinha, para o aviso nunca mentir.
 */
export function lerGravado(path: string, geradoEm: string): Gravado | null {
  try {
    const bruto = window.localStorage.getItem(chave(path));
    if (!bruto) return null;

    const valor = JSON.parse(bruto) as Partial<Gravado>;
    if (typeof valor.conteudo !== 'string' || typeof valor.em !== 'number') return null;

    const build = Date.parse(geradoEm);
    if (Number.isFinite(build) && valor.em <= build) {
      esquecerGravado(path);
      return null;
    }
    return {
      conteudo: valor.conteudo,
      em: valor.em,
      commitUrl: typeof valor.commitUrl === 'string' ? valor.commitUrl : '',
      novo: Boolean(valor.novo),
    };
  } catch {
    return null;
  }
}

/** `há 3 minutos` — o quanto o site está atrasado, em português corrente. */
export function haQuantoTempo(em: number): string {
  const minutos = Math.max(0, Math.round((Date.now() - em) / 60000));
  if (minutos < 1) return 'agora há pouco';
  if (minutos === 1) return 'há um minuto';
  if (minutos < 60) return `há ${minutos} minutos`;
  const horas = Math.round(minutos / 60);
  return horas === 1 ? 'há uma hora' : `há ${horas} horas`;
}
