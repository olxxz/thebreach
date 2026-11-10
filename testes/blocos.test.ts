import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  corridoParaMd, juntar, lerCorrido, lerLista, lerTabela, listaParaMd, partir, podeSerRico, tabelaParaMd,
} from '../src/lib/breach/blocos';

const DOC = `# Minas
![As minas](hero.webp)

**Classificação:** Geografia › lugar

**Status:** rascunho

---

## 1. Descrição geral

\`[CANÔNICO]\` As cavernas sob *Luora* (ver \`02-geografia/luora/\`), com **força**.

- um
- dois
  - dois e meio

| Para o povo | Serve |
|---|---|
| areia | vidro |

> **Recorte** — um destaque.

\`\`\`diff
- a
+ b
\`\`\`
`;

test('partir e juntar devolvem o texto idêntico', () => {
  for (const texto of [DOC, '', '\n\n# só título', 'sem quebra no fim', 'a\n\n\n\nb\n']) {
    assert.equal(juntar(partir(texto)), texto);
  }
});

test('cada bloco é reconhecido pelo tipo', () => {
  const tipos = partir(DOC).map((b) => b.tipo);
  assert.deepEqual(tipos, [
    'titulo', 'imagem', 'campo', 'campo', 'regua', 'titulo', 'paragrafo', 'lista', 'tabela', 'citacao', 'codigo',
  ]);
});

test('linha de campo depois da primeira seção é parágrafo, não cabeçalho', () => {
  const blocos = partir('# T\n\n## 1. S\n\n**Nota:** texto\n');
  assert.equal(blocos[blocos.length - 1].tipo, 'paragrafo');
});

test('texto corrido volta idêntico', () => {
  const casos = [
    '`[CANÔNICO — provisório]` O *nome* é **forte** e ***os dois***.',
    'ver [Luora](../luora/) e `02-geografia/luora/` §2',
    'asterisco solto * e sublinhado_no_meio e [colchete] sem link',
    'áudio: [Lu-ó-ra](pronuncia-luora.mp3) · [celestial](x.mp3)',
  ];
  for (const md of casos) assert.equal(corridoParaMd(lerCorrido(md)), md);
});

test('lista aninhada e tabela são lidas e reescritas sem mudança', () => {
  const lista = '- um\n- dois\n  - dois e meio';
  assert.equal(listaParaMd(lerLista(lista)!), lista);
  const tabela = lerTabela('| A | B |\n|---|---|\n| `a|b` | c |')!;
  assert.deepEqual(tabela.linhas, [['`a|b`', 'c']]);
  assert.equal(tabelaParaMd(tabela), '| A | B |\n|---|---|\n| `a|b` | c |');
});

test('o que o editor não sabe reescrever fica como markdown', () => {
  const [lista] = partir('- item que continua\n  na linha de baixo');
  assert.equal(podeSerRico(lista), false);
  const [codigo] = partir('```\nx\n```');
  assert.equal(podeSerRico(codigo), false);
  const [titulo] = partir('## ');
  assert.equal(podeSerRico(titulo), true);
});
