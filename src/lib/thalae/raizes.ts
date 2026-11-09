/**
 * As raízes da Thalae, lidas do acervo (`01-cosmologia/thalae/` §5), e a
 * leitura de uma raiz escrita — `’ìir`, `phae`, `lú` — nos traços do selo.
 *
 * A tabela de raízes é do acervo: raiz nova que entra lá aparece na oficina
 * sem ninguém tocar no site.
 */

import type { Consoante, Raiz, Vogal } from './selo';

export interface RaizDoAcervo {
  texto: string;
  sentido: string;
  /** O grupo em que o acervo a lista: "Cosmos e criação", "Domínios"… */
  grupo: string;
}

const VOGAIS: Record<string, { vogal: Vogal; tom?: 'sobe' | 'desce' }> = {
  a: { vogal: 'a' }, e: { vogal: 'e' }, i: { vogal: 'i' }, o: { vogal: 'o' }, u: { vogal: 'u' },
  á: { vogal: 'a', tom: 'sobe' }, é: { vogal: 'e', tom: 'sobe' }, í: { vogal: 'i', tom: 'sobe' },
  ó: { vogal: 'o', tom: 'sobe' }, ú: { vogal: 'u', tom: 'sobe' },
  à: { vogal: 'a', tom: 'desce' }, è: { vogal: 'e', tom: 'desce' }, ì: { vogal: 'i', tom: 'desce' },
  ò: { vogal: 'o', tom: 'desce' }, ù: { vogal: 'u', tom: 'desce' },
};

const SOPRADAS = ['ph', 'th', 'rh', 'vh'] as const;
const SIMPLES = new Set(['s', 'v', 'h', 'l', 'r', 'm', 'n', 'y']);

/** `mh` não tem traço próprio no acervo: escreve-se com as marcas de `m` e `h`. */
function consoantes(trecho: string): Consoante[] {
  const saida: Consoante[] = [];
  let i = 0;
  while (i < trecho.length) {
    const par = trecho.slice(i, i + 2);
    if ((SOPRADAS as readonly string[]).includes(par)) {
      saida.push(par as Consoante);
      i += 2;
      continue;
    }
    if (SIMPLES.has(trecho[i])) saida.push(trecho[i] as Consoante);
    i += 1;
  }
  return saida;
}

/**
 * Uma raiz escrita → os traços dela no selo.
 *
 * Segue as regras de `01-cosmologia/thalae/` §2 e §4: `’` é som inspirado,
 * agudo sobe e grave desce, vogal dobrada é longa, duas vogais diferentes
 * juntas são um acorde. Raiz sem vogal (*myr*, *nyr*) toma o `y` por vogal,
 * com o arco de *i*.
 */
export function analisarRaiz(texto: string, sentido = ''): Raiz {
  let resto = texto.trim().toLowerCase().normalize('NFC');
  const raiz: Raiz = { texto: texto.trim(), sentido, vogal: 'a' };

  if (/^[’'ʼ]/.test(resto)) {
    raiz.inspirado = true;
    resto = resto.slice(1);
  }
  resto = resto.replace(/-$/, '').replace(/[·.]/g, '');

  const letras = [...resto];
  let inicio = letras.findIndex((letra) => letra in VOGAIS);
  let fim = inicio;
  if (inicio === -1) {
    // Sem vogal escrita: o `y` faz as vezes dela.
    inicio = letras.indexOf('y');
    if (inicio === -1) return { ...raiz, antes: consoantes(resto) };
    fim = inicio + 1;
    raiz.vogal = 'i';
  } else {
    while (fim < letras.length && letras[fim] in VOGAIS) fim += 1;
    const nucleo = letras.slice(inicio, fim).map((letra) => VOGAIS[letra]);
    raiz.vogal = nucleo[0].vogal;
    const tom = nucleo.find((v) => v.tom)?.tom;
    if (tom) raiz.tom = tom;
    if (nucleo.length > 1) {
      if (nucleo.every((v) => v.vogal === nucleo[0].vogal)) raiz.longa = true;
      else raiz.acorde = true;
    }
  }

  const antes = consoantes(letras.slice(0, inicio).join(''));
  const depois = consoantes(letras.slice(fim).join(''));
  if (antes.length) raiz.antes = antes;
  if (depois.length) raiz.depois = depois;
  return raiz;
}

/** Lê as tabelas `| Raiz | Sentido | Raiz | Sentido |` da seção de raízes. */
export function lerRaizes(markdown: string): RaizDoAcervo[] {
  const linhas = markdown.split('\n');
  const inicio = linhas.findIndex((linha) => /^##\s+(\d+\.\s+)?Ra[ií]zes\s*$/i.test(linha));
  if (inicio === -1) return [];

  const raizes: RaizDoAcervo[] = [];
  let grupo = '';
  for (const linha of linhas.slice(inicio + 1)) {
    if (/^##\s+/.test(linha)) break;
    const titulo = /^\*\*([^*]+)\*\*\s*$/.exec(linha.trim());
    if (titulo) {
      grupo = titulo[1].trim();
      continue;
    }
    if (!linha.trim().startsWith('|')) continue;
    const celulas = linha.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (celulas.every((c) => /^:?-{2,}:?$/.test(c)) || /^raiz$/i.test(celulas[0])) continue;
    for (let i = 0; i + 1 < celulas.length; i += 2) {
      const texto = celulas[i].replace(/[*`]/g, '').trim();
      const sentido = celulas[i + 1].replace(/^prefixo:\s*/i, '').replace(/[*`"“”]/g, '').trim();
      if (texto && sentido) raizes.push({ texto, sentido, grupo });
    }
  }
  return raizes;
}
