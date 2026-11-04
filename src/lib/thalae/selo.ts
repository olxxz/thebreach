/**
 * Geometria dos selos da Thalae (`01-cosmologia/thalae/` §4), como funções
 * puras: dado um nome em raízes, devolve os traços do selo, cada um marcado
 * com o anel a que pertence — é o que permite ler o selo anel por anel.
 *
 * Regras do acervo:
 *  - lê-se do centro para fora, uma raiz por anel, num traço contínuo;
 *  - a vogal é o comprimento do arco (a 300°, e 250°, i 200°, o 150°, u 100°);
 *  - vogal longa: traço grosso; acorde: arco fino paralelo, por fora;
 *  - consoantes são marcas sobre o arco (as de antes perto do começo, as de
 *    depois perto do fim);
 *  - tom é um ponto, por fora se sobe, por dentro se desce; som inspirado é
 *    uma ponta voltada para o centro;
 *  - a queda racha o selo.
 */

export type Vogal = 'a' | 'e' | 'i' | 'o' | 'u';
export type Consoante = 's' | 'v' | 'h' | 'l' | 'r' | 'm' | 'n' | 'y' | 'ph' | 'th' | 'rh' | 'vh';

export interface Raiz {
  /** Como a raiz se transcreve, com acentos e marcas: `’ìir`, `lú`, `ha·e`. */
  texto: string;
  sentido: string;
  vogal: Vogal;
  antes?: Consoante[];
  depois?: Consoante[];
  tom?: 'sobe' | 'desce';
  inspirado?: boolean;
  longa?: boolean;
  acorde?: boolean;
}

export interface Traco {
  /** Anel da raiz a que o traço pertence; -1 para a origem e a fratura. */
  anel: number;
  tipo: 'path' | 'circle';
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  largura: number;
  cheio?: boolean;
  fratura?: boolean;
}

export const ARCO: Record<Vogal, number> = { a: 300, e: 250, i: 200, o: 150, u: 100 };

const TAMANHO = 320;
const CENTRO = TAMANHO / 2;
const R0 = 30;

function ponto(r: number, graus: number): [number, number] {
  const t = ((graus - 90) * Math.PI) / 180;
  return [CENTRO + r * Math.cos(t), CENTRO + r * Math.sin(t)];
}

const f = (n: number): string => n.toFixed(1);

function linha(a: [number, number], b: [number, number]): string {
  return `M${f(a[0])},${f(a[1])} L${f(b[0])},${f(b[1])}`;
}

function arco(r: number, de: number, ate: number): string {
  const [x0, y0] = ponto(r, de);
  const [x1, y1] = ponto(r, ate);
  return `M${f(x0)},${f(y0)} A${r},${r} 0 ${ate - de > 180 ? 1 : 0} 1 ${f(x1)},${f(y1)}`;
}

function marca(tipo: Consoante, r: number, g: number): string[] {
  const fora = (d: number) => ponto(r + d, g);
  const curva = (dir: 1 | -1): string => {
    const a = ponto(r, g - 4);
    const c = ponto(r + dir * 14, g);
    const b = ponto(r, g + 4);
    return `M${f(a[0])},${f(a[1])} Q${f(c[0])},${f(c[1])} ${f(b[0])},${f(b[1])}`;
  };
  const cruz = [linha(fora(9), fora(-9)), linha(ponto(r + 6, g - 5), ponto(r - 6, g + 5))];
  const sopro = linha(ponto(r, g + 7), ponto(r - 9, g + 7));
  switch (tipo) {
    case 's':
      return [linha(ponto(r, g), fora(9))];
    case 'v':
      return [linha(ponto(r, g), fora(9)), linha(ponto(r + 9, g - 4), ponto(r + 9, g + 4))];
    case 'h':
      return [linha(ponto(r, g), fora(-9))];
    case 'l':
      return [curva(1)];
    case 'r':
      return [curva(-1)];
    case 'y': {
      const p = [0, 1, 2, 3].map((i) => ponto(r + (i % 2 ? 4 : 0) + 3 * i, g + (i % 2 ? -3 : 3)));
      return [`M${p.map(([x, y]) => `${f(x)},${f(y)}`).join(' L')}`];
    }
    case 'ph':
    case 'th':
      return cruz;
    case 'rh':
      return [curva(-1), sopro];
    case 'vh':
      return [linha(ponto(r, g), fora(9)), linha(ponto(r + 9, g - 4), ponto(r + 9, g + 4)), sopro];
    default:
      return [];
  }
}

function passoPara(n: number): number {
  return Math.min(32, (CENTRO - 44) / Math.max(n, 1));
}

/**
 * Quadro do selo, em coordenadas do desenho: só o espaço que os anéis ocupam,
 * com folga para as marcas por fora. Um selo de um anel não fica perdido no
 * meio de um quadro feito para sete.
 */
export function quadroDoSelo(n: number): string {
  const alcance = R0 + (Math.max(n, 1) - 1) * passoPara(n) + 26;
  return `${f(CENTRO - alcance)} ${f(CENTRO - alcance)} ${f(alcance * 2)} ${f(alcance * 2)}`;
}

/** Os traços do selo de um nome. `caido` acrescenta a fratura da queda. */
export function tracarSelo(raizes: Raiz[], caido = false): Traco[] {
  const tracos: Traco[] = [];
  const n = raizes.length;
  const passo = passoPara(n);
  let angulo = 0;

  tracos.push({ anel: -1, tipo: 'circle', cx: CENTRO, cy: CENTRO, r: 5, largura: 2 });
  tracos.push({ anel: 0, tipo: 'path', d: linha(ponto(5, 0), ponto(R0, 0)), largura: 2.2 });

  raizes.forEach((raiz, k) => {
    const r = R0 + k * passo;
    const L = ARCO[raiz.vogal];
    const fim = angulo + L;
    tracos.push({ anel: k, tipo: 'path', d: arco(r, angulo, fim), largura: raiz.longa ? 4.4 : 2.2 });
    if (raiz.acorde) tracos.push({ anel: k, tipo: 'path', d: arco(r + 6, angulo + L * 0.3, angulo + L * 0.7), largura: 1.4 });
    if (raiz.inspirado) {
      const g = angulo + L * 0.06;
      const [a, b, c] = [ponto(r + 8, g - 5), ponto(r - 8, g), ponto(r + 8, g + 5)];
      tracos.push({ anel: k, tipo: 'path', d: `M${f(a[0])},${f(a[1])} L${f(b[0])},${f(b[1])} L${f(c[0])},${f(c[1])}`, largura: 1.8 });
    }
    (raiz.antes ?? []).forEach((c, i) => {
      if (c === 'm' || c === 'n') {
        const [x, y] = ponto(r, angulo + L * (0.14 + 0.11 * i));
        tracos.push({ anel: k, tipo: 'circle', cx: x, cy: y, r: 4, largura: 1.8, cheio: c === 'm' });
      } else {
        for (const d of marca(c, r, angulo + L * (0.14 + 0.11 * i))) tracos.push({ anel: k, tipo: 'path', d, largura: 1.9 });
      }
    });
    [...(raiz.depois ?? [])].reverse().forEach((c, i) => {
      const g = fim - L * (0.12 + 0.11 * i);
      if (c === 'm' || c === 'n') {
        const [x, y] = ponto(r, g);
        tracos.push({ anel: k, tipo: 'circle', cx: x, cy: y, r: 4, largura: 1.8, cheio: c === 'm' });
      } else {
        for (const d of marca(c, r, g)) tracos.push({ anel: k, tipo: 'path', d, largura: 1.9 });
      }
    });
    if (raiz.tom) {
      const [x, y] = ponto(r + (raiz.tom === 'sobe' ? 16 : -16), angulo + L * 0.5);
      tracos.push({ anel: k, tipo: 'circle', cx: x, cy: y, r: 3.2, largura: 0, cheio: true });
    }
    if (k < n - 1) tracos.push({ anel: k, tipo: 'path', d: linha(ponto(r, fim), ponto(r + passo, fim)), largura: 2.2 });
    else {
      const [x, y] = ponto(r, fim);
      tracos.push({ anel: k, tipo: 'circle', cx: x, cy: y, r: 4, largura: 2 });
    }
    angulo = fim % 360;
  });

  if (caido) {
    // Semente fixa: a fratura de um nome é sempre a mesma.
    let semente = raizes.length * 7919 + 13;
    const acaso = (): number => {
      semente = (semente * 16807) % 2147483647;
      return (semente - 1) / 2147483646;
    };
    const pontos: [number, number][] = [];
    for (let r = 0; r < CENTRO - 14; r += 10 + acaso() * 10) pontos.push(ponto(r, 118 + (acaso() - 0.5) * 12));
    const d = `M${pontos.map(([x, y]) => `${f(x)},${f(y)}`).join(' L')}`;
    tracos.push({ anel: -1, tipo: 'path', d, largura: 9, fratura: true });
  }
  return tracos;
}

