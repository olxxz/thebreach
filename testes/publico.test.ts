import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cortarTrecho, ehCaminhoDoAtelie, midiaCitada, paraPublico } from '../src/lib/breach/publico';

test('a pasta de propostas e os bastidores do 00-meta são do Ateliê', () => {
  assert.equal(ehCaminhoDoAtelie('10-propostas/aunruu/README.md'), true);
  assert.equal(ehCaminhoDoAtelie('00-meta/AUDITORIA.md'), true);
  assert.equal(ehCaminhoDoAtelie('00-meta/CONVENCOES.md'), false);
  assert.equal(ehCaminhoDoAtelie('01-cosmologia/thalae/README.md'), false);
  assert.equal(paraPublico('`[CANÔNICO]` x', '10-propostas/a.md').doAtelie, true);
});

test('o trecho do Ateliê vai até o próximo marcador', () => {
  assert.equal(cortarTrecho('`[CANÔNICO]` a. `[PROPOSTA]` b. `[CRENÇA — povo]` c.').texto, '`[CANÔNICO]` a. `[CRENÇA — povo]` c.');
  assert.equal(cortarTrecho('`[PROPOSTA]` só isto').texto, null);
  assert.equal(cortarTrecho('sem marcador').tinhaMarcador, false);
});

test('marcadores colados formam um grupo: crença proposta sai inteira', () => {
  assert.equal(cortarTrecho('`[PROPOSTA]` `[CRENÇA — povo]` Que o deus vê.').texto, null);
});

test('EM ABERTO é público', () => {
  assert.equal(cortarTrecho('`[EM ABERTO]` o que foi a Catástrofe.').texto, '`[EM ABERTO]` o que foi a Catástrofe.');
});

const DOC = `# Coisa

**Classificação:** X

**Documentos relacionados:** [A](../a/), [P](../../10-propostas/p/)

---

## 1. Descrição geral

\`[CANÔNICO]\` Firme (ver \`10-propostas/p/\`).

\`[PROPOSTA]\` Ideia:

- um
- dois

![Imagem da ideia](ideia.webp)

| Nome | Papel |
|---|---|
| **A** | \`[CANÔNICO]\` faz |
| **B** | \`[PROPOSTA]\` talvez |
| \`[LACUNA]\` | |

---

## 2. Registro

### 2.1 O que se sabe

\`[LACUNA]\` Nada.

---

## 7. Lacunas

- tudo

---

## 8. Ocorrências

- narrativa x
`;

test('documento: corta propostas, lacunas, o que elas anunciam e as seções vazias', () => {
  const { texto, doAtelie } = paraPublico(DOC, '04-bestiario/coisa/README.md');
  assert.equal(doAtelie, false);
  assert.match(texto, /`\[CANÔNICO\]` Firme\.\n/);
  assert.doesNotMatch(texto, /PROPOSTA|LACUNA|10-propostas|ideia\.webp|- um|## 2\.|## 7\./);
  assert.match(texto, /\[A\]\(\.\.\/a\/\)\n/);
  assert.doesNotMatch(texto, /\*\*B\*\*/);
  assert.match(texto, /## 8\. Ocorrências/);
  assert.deepEqual(midiaCitada(texto, '04-bestiario/coisa/README.md'), []);
});

test('documento só de lacunas é do Ateliê; índice sem marcador não é', () => {
  assert.equal(paraPublico('# X\n\n## 1. A\n\n`[LACUNA]` nada.\n', '04-bestiario/x/README.md').doAtelie, true);
  assert.equal(paraPublico('# Cat\n\nTexto.\n\n## Documentos\n\n- a\n', '04-bestiario/README.md').doAtelie, false);
});

test('cercas de código ficam intactas', () => {
  const md = '# C\n\n```\n`[PROPOSTA]` exemplo\n```\n\n`[CANÔNICO]` ok\n';
  assert.match(paraPublico(md, '00-meta/CONVENCOES.md').texto, /`\[PROPOSTA\]` exemplo/);
});
