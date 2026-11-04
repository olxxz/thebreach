import type { Raiz } from './selo';
import { urlDaImagem } from '@/lib/breach/imagens';

/** Pasta da Thalae no acervo: os áudios moram ao lado do documento. */
const PASTA = '01-cosmologia/thalae';

export function audioDaThalae(arquivo: string): string {
  return urlDaImagem(`${PASTA}/${arquivo}`);
}

export interface Palavra {
  id: string;
  nome: string;
  transcricao: string;
  sentido: string;
  caido: boolean;
  audio: string;
  raizes: Raiz[];
}

/** Os nomes registrados em `01-cosmologia/thalae/`, prontos para o leitor de selos. */
export const PALAVRAS: Palavra[] = [
  {
    id: 'thalae',
    nome: 'Thalae',
    transcricao: 'Tha-la·e',
    sentido: 'a palavra cantada — o nome da própria língua',
    caido: false,
    audio: 'pronuncia-thalae.mp3',
    raizes: [
      { texto: 'tha', sentido: 'palavra', vogal: 'a', antes: ['th'] },
      { texto: 'la·e', sentido: 'cantar', vogal: 'a', antes: ['l'], acorde: true },
    ],
  },
  {
    id: 'uphirr',
    nome: 'Uphirr',
    transcricao: 'Uph-’ìir',
    sentido: 'aquele que recebe a vida — um caído menor, de nome curto',
    caido: true,
    audio: 'pronuncia-uphirr.mp3',
    raizes: [
      { texto: 'uph', sentido: 'receber', vogal: 'u', depois: ['ph'] },
      { texto: '’ìir', sentido: 'vida', vogal: 'i', depois: ['r'], inspirado: true, tom: 'desce', longa: true },
    ],
  },
  {
    id: 'nefando',
    nome: 'Nefando do sangue',
    transcricao: 'Sàv-om-’ìir-rhe-ith-lú-ha·e',
    sentido: 'aquele que viu a medida da semente da vida correr pela memória do sopro',
    caido: true,
    audio: 'pronuncia-nome-verdadeiro.mp3',
    raizes: [
      { texto: 'sàv', sentido: 'semente, linhagem', vogal: 'a', antes: ['s', 'v'], tom: 'desce' },
      { texto: 'om', sentido: 'medida', vogal: 'o', depois: ['m'] },
      { texto: '’ìir', sentido: 'vida', vogal: 'i', depois: ['r'], inspirado: true, tom: 'desce', longa: true },
      { texto: 'rhe', sentido: 'o sangue que corre', vogal: 'e', antes: ['rh'] },
      { texto: 'ith', sentido: 'memória', vogal: 'i', depois: ['th'] },
      { texto: 'lú', sentido: 'ver, testemunhar', vogal: 'u', antes: ['l'], tom: 'sobe' },
      { texto: 'ha·e', sentido: 'sopro', vogal: 'a', antes: ['h'], acorde: true },
    ],
  },
];

/** Para o exercício: um selo para ler sem ver a resposta antes. */
export const EXERCICIO: Palavra = {
  id: 'alu',
  nome: 'Alu',
  transcricao: 'A-lu',
  sentido: 'aquele que viu — a testemunha',
  caido: false,
  audio: '',
  raizes: [
    { texto: 'a-', sentido: 'aquele que…', vogal: 'a' },
    { texto: 'lu', sentido: 'ver', vogal: 'u', antes: ['l'] },
  ],
};

const NOME_CONSOANTE: Record<string, string> = {
  s: 's — risco para fora',
  v: 'v — risco para fora com travessão',
  h: 'h — risco para dentro',
  l: 'l — corcova para fora',
  r: 'r — corcova para dentro',
  m: 'm — ponto cheio',
  n: 'n — ponto vazado',
  y: 'y — zigue-zague',
  ph: 'ph — cruz',
  th: 'th — cruz',
  rh: 'rh — corcova para dentro com sopro',
  vh: 'vh — travessão com sopro',
};

/** Como ler um anel, em frases curtas: o que cada traço diz. */
export function lerAnel(raiz: Raiz): string[] {
  const linhas = [`Arco de ${({ a: 300, e: 250, i: 200, o: 150, u: 100 } as const)[raiz.vogal]}°: a vogal é ${raiz.vogal}.`];
  if (raiz.longa) linhas.push('Traço grosso: a vogal é longa.');
  if (raiz.acorde) linhas.push('Arco fino por fora: acorde vocálico.');
  if (raiz.inspirado) linhas.push('Ponta voltada para o centro: som inspirado.');
  for (const c of raiz.antes ?? []) linhas.push(`Antes da vogal: ${NOME_CONSOANTE[c]}.`);
  for (const c of raiz.depois ?? []) linhas.push(`Depois da vogal: ${NOME_CONSOANTE[c]}.`);
  if (raiz.tom) linhas.push(raiz.tom === 'sobe' ? 'Ponto por fora: o tom sobe.' : 'Ponto por dentro: o tom desce.');
  return linhas;
}
