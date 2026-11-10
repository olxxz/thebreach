/**
 * O cofre do Ateliê: o token do GitHub cifrado por uma senha.
 *
 * O site é estático e não tem servidor que guarde segredo. O que dá para fazer
 * sem servidor é cifrar o token no navegador e publicar só o resultado: quem
 * tem a senha abre; quem não tem, vê bytes. A cifra é AES-GCM, e a chave sai
 * da senha por PBKDF2 com muitas voltas, para que testar senhas seja caro.
 *
 * O cofre fica à vista de quem abrir o site. A proteção é a senha — por isso
 * ela precisa ser longa.
 */

export const CAMINHO_COFRE = '00-meta/COFRE.md';
export const SENHA_MINIMA = 12;

const VOLTAS = 600_000;

interface Cofre {
  v: 1;
  voltas: number;
  sal: string;
  iv: string;
  dados: string;
}

const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const deB64 = (texto: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(texto);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

async function chaveDe(senha: string, sal: Uint8Array<ArrayBuffer>, voltas: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: voltas },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Cifra o token com a senha. Devolve o cofre, em JSON. */
export async function fecharCofre(token: string, senha: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const chave = await chaveDe(senha, sal, VOLTAS);
  const dados = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(token));
  const cofre: Cofre = { v: 1, voltas: VOLTAS, sal: b64(sal), iv: b64(iv), dados: b64(new Uint8Array(dados)) };
  return JSON.stringify(cofre);
}

/** Abre o cofre com a senha. `null` quando a senha não é a certa. */
export async function abrirCofre(cofreJson: string, senha: string): Promise<string | null> {
  try {
    const cofre = JSON.parse(cofreJson) as Cofre;
    const chave = await chaveDe(senha, deB64(cofre.sal), cofre.voltas);
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(cofre.iv) }, chave, deB64(cofre.dados));
    return new TextDecoder().decode(claro);
  } catch {
    return null;
  }
}

/** O arquivo do acervo que carrega o cofre. É `.md` para o site ser avisado. */
export function documentoDoCofre(cofreJson: string): string {
  return [
    '# Cofre do editor',
    '',
    'O token do Ateliê do site, cifrado pela senha do Criador. É gerado pelo próprio site; não se edita à mão. Apagar este arquivo desliga a entrada por senha.',
    '',
    '```json',
    cofreJson,
    '```',
    '',
  ].join('\n');
}

/** Tira o cofre de dentro do arquivo do acervo. */
export function lerDocumentoDoCofre(markdown: string): string | null {
  const achado = /```json\s*\n([\s\S]*?)\n```/.exec(markdown);
  if (!achado) return null;
  try {
    const cofre = JSON.parse(achado[1]) as Partial<Cofre>;
    return cofre.v === 1 && cofre.dados ? achado[1].trim() : null;
  } catch {
    return null;
  }
}
