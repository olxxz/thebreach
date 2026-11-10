/**
 * Traz as ilustrações do acervo para dentro do site, antes do build.
 *
 * O repositório `breach` é privado: o navegador não consegue buscar as imagens
 * dele. Este script copia toda imagem do acervo para `public/acervo/`,
 * preservando o caminho, de onde o site as serve como arquivos próprios.
 *
 * As imagens moram junto da entidade que ilustram (CONVENCOES.md §8), então não
 * há uma pasta única a varrer: o critério é a extensão.
 *
 * Só vem o que o público vê (CONVENCOES.md §1): a mídia citada pela versão
 * pública de algum documento e o `hero` de cada entidade pública. Imagem do
 * Ateliê não é copiada — o Ateliê a busca direto do acervo, com o token.
 * Por isso o script roda com `--import tsx`: o filtro é o mesmo do build.
 *
 * Fontes, na mesma ordem do resto da camada de acesso:
 *   1. BREACH_LOCAL_PATH — pasta local com o acervo.
 *   2. API do GitHub, autenticada por BREACH_TOKEN.
 */

import { mkdir, rm, writeFile, readdir, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { ehCaminhoDoAtelie, midiaCitada, paraPublico } from '../src/lib/breach/publico.ts';

const OWNER = process.env.BREACH_OWNER ?? 'olxxz';
const REPO = process.env.BREACH_REPO ?? 'breach';
const REF = process.env.BREACH_REF ?? 'main';
// Imagens e áudios (as pronúncias da Thalae) — tudo o que o site serve do acervo.
const EXTENSOES = new Set(['png', 'webp', 'jpg', 'jpeg', 'avif', 'svg', 'mp3', 'ogg']);
const DESTINO = path.join(process.cwd(), 'public', 'acervo');

function ehImagem(caminho) {
  return EXTENSOES.has(caminho.split('.').pop()?.toLowerCase() ?? '');
}

const ehDocumento = (caminho) => caminho.endsWith('.md');

const local = process.env.BREACH_LOCAL_PATH ? path.resolve(process.env.BREACH_LOCAL_PATH) : null;
const usandoLocal = Boolean(local && existsSync(local));

function cabecalhos(accept) {
  const headers = { Accept: accept, 'User-Agent': 'compendio-breach-site' };
  if (process.env.BREACH_TOKEN) headers.Authorization = `Bearer ${process.env.BREACH_TOKEN}`;
  return headers;
}

async function buscar(url, accept) {
  let ultimoErro = null;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    try {
      const resposta = await fetch(url, { headers: cabecalhos(accept) });
      if (resposta.ok) return resposta;
      if ([401, 403, 404].includes(resposta.status)) {
        throw new Error(
          `Sem acesso ao acervo (${resposta.status}). O repositório é privado: ` +
            'defina BREACH_TOKEN com um token de leitura.',
        );
      }
      ultimoErro = new Error(`${resposta.status} ${resposta.statusText}`);
    } catch (erro) {
      if (erro instanceof Error && erro.message.startsWith('Sem acesso')) throw erro;
      ultimoErro = erro;
    }
    await new Promise((r) => setTimeout(r, 400 * 2 ** tentativa));
  }
  throw new Error(`Falha ao ler ${url}: ${ultimoErro?.message ?? ultimoErro}`);
}

async function listarLocal() {
  const achados = [];
  const andar = async (dir) => {
    for (const entrada of await readdir(path.join(local, dir), { withFileTypes: true })) {
      if (entrada.name.startsWith('.')) continue;
      const rel = dir ? `${dir}/${entrada.name}` : entrada.name;
      if (entrada.isDirectory()) await andar(rel);
      else if (ehImagem(rel) || ehDocumento(rel)) achados.push(rel);
    }
  };
  await andar('');
  return achados;
}

async function listarRemoto() {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${REF}?recursive=1`;
  const dados = await (await buscar(url, 'application/vnd.github+json')).json();
  return (dados.tree ?? [])
    .filter((no) => no.type === 'blob' && (ehImagem(no.path) || ehDocumento(no.path)))
    .map((no) => no.path);
}

async function baixar(caminho) {
  const alvo = path.join(DESTINO, caminho);
  await mkdir(path.dirname(alvo), { recursive: true });

  if (usandoLocal) {
    await copyFile(path.join(local, caminho), alvo);
    return (await stat(alvo)).size;
  }

  const url =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/` +
    `${caminho.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(REF)}`;
  const resposta = await buscar(url, 'application/vnd.github.raw');
  const bytes = Buffer.from(await resposta.arrayBuffer());
  await writeFile(alvo, bytes);
  return bytes.length;
}

async function lerTexto(caminho) {
  if (usandoLocal) return readFile(path.join(local, caminho), 'utf8');
  const url =
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/` +
    `${caminho.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(REF)}`;
  return (await buscar(url, 'application/vnd.github.raw')).text();
}

const HEROS = ['png', 'webp', 'jpg', 'jpeg', 'avif', 'svg'].map((ext) => `hero.${ext}`);

/** A mídia que o público vê: citada por documento público, ou hero de entidade pública. */
async function midiaPublica(todos) {
  const existe = new Set(todos);
  const ficam = new Set();
  const versoes = new Map();
  for (const doc of todos.filter(ehDocumento)) versoes.set(doc, paraPublico(await lerTexto(doc), doc));
  const publicos = new Set([...versoes].filter(([, v]) => !v.doAtelie).map(([doc]) => doc));
  // Entidade só de lacunas com filhos públicos fica, como moldura (ver source.ts).
  for (const doc of versoes.keys()) {
    if (!/(^|\/)README\.md$/i.test(doc) || publicos.has(doc) || ehCaminhoDoAtelie(doc)) continue;
    const pasta = doc.slice(0, doc.lastIndexOf('/') + 1);
    if ([...publicos].some((outro) => outro !== doc && outro.startsWith(pasta))) publicos.add(doc);
  }
  for (const doc of publicos) {
    const publico = versoes.get(doc);
    for (const midia of midiaCitada(publico.texto, doc)) if (existe.has(midia)) ficam.add(midia);
    if (/(^|\/)README\.md$/i.test(doc)) {
      const pasta = doc.includes('/') ? doc.slice(0, doc.lastIndexOf('/') + 1) : '';
      for (const hero of HEROS) if (existe.has(pasta + hero)) ficam.add(pasta + hero);
    }
  }
  return todos.filter((caminho) => ehImagem(caminho) && ficam.has(caminho));
}

const todos = usandoLocal ? await listarLocal() : await listarRemoto();
const arquivos = await midiaPublica(todos);
const deixadas = todos.filter(ehImagem).length - arquivos.length;

// Limpa antes para que uma imagem removida do acervo saia também do site.
await rm(DESTINO, { recursive: true, force: true });

if (arquivos.length === 0) {
  console.log('Acervo sem ilustrações: nada a copiar.');
} else {
  let total = 0;
  for (const caminho of arquivos) {
    total += await baixar(caminho);
  }
  const fonte = usandoLocal ? local : `${OWNER}/${REPO}@${REF}`;
  console.log(
    `${arquivos.length} ilustraç${arquivos.length > 1 ? 'ões' : 'ão'} ` +
      `(${(total / 1024).toFixed(0)} KB) de ${fonte} → public/acervo/` +
      (deixadas ? ` — ${deixadas} do Ateliê ficaram de fora` : ''),
  );
}
