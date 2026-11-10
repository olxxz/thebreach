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
    // A tabela de raízes acaba onde começa a subseção da ordem (§5.1).
    if (/^#{2,3}\s+/.test(linha)) break;
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

export interface NomeDoAcervo {
  nome: string;
  raizes: string[];
  sentido: string;
  /** Caminho do áudio no acervo, quando a tabela de pronúncias tem o nome. */
  audio: string | null;
}

const semMarcas = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ’'·\-\s]/g, '').toLowerCase();

/**
 * Os nomes registrados, com as raízes de cada um: a tabela de
 * `01-cosmologia/thalae/` §5.1 (`| Nome | Raízes | Sentido … |`), casada com a
 * tabela de pronúncias pelo nome.
 */
export function lerNomes(markdown: string): NomeDoAcervo[] {
  const linhas = markdown.split('\n');

  // Nome → áudio da fala, tirado de `| Palavra | [fala](arquivo.mp3) | … |`.
  const audios = new Map<string, string>();
  for (const linha of linhas) {
    const m = /^\|\s*([^|]+?)\s*\|\s*\[[^\]]*\]\(([^)]+\.mp3)\)/.exec(linha);
    if (!m) continue;
    for (const parte of m[1].split(/[()]/)) {
      if (parte.trim()) audios.set(semMarcas(parte), m[2]);
    }
  }

  const inicio = linhas.findIndex((linha) => /^###\s+5\.1\b/.test(linha));
  if (inicio === -1) return [];
  const nomes: NomeDoAcervo[] = [];
  for (const linha of linhas.slice(inicio + 1)) {
    if (/^#{2,3}\s/.test(linha)) break;
    if (!linha.trim().startsWith('|')) continue;
    const c = linha.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
    if (c.length < 3 || /^:?-+:?$/.test(c[0]) || /^nome$/i.test(c[0])) continue;
    const nome = c[0].replace(/[*`]/g, '');
    nomes.push({
      nome,
      raizes: c[1].split('·').map((r) => r.replace(/[*`]/g, '').trim()).filter(Boolean),
      sentido: c[2].replace(/["“”*]/g, ''),
      audio: audios.get(semMarcas(nome)) ?? null,
    });
  }
  return nomes;
}

/** A raiz do acervo que uma raiz escrita num nome usa: `’ìir` → `ir`. */
export function raizBase(escrita: string, raizes: RaizDoAcervo[]): RaizDoAcervo | null {
  const alvo = semMarcas(escrita);
  const juntar = (t: string): string => t.replace(/([aeiou])\1/g, '$1');
  return (
    raizes.find((r) => semMarcas(r.texto) === alvo) ??
    raizes.find((r) => juntar(semMarcas(r.texto)) === juntar(alvo)) ??
    null
  );
}
