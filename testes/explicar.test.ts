import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explicarMudanca } from '../src/lib/breach/explicar';

const ANTES = `# Grifo

**Status:** rascunho

---

## 1. Descrição geral

\`[CANÔNICO]\` Ave grande.

## 2. Características

\`[LACUNA]\` Porte.
`;

test('explica por seção, com marcadores e status', () => {
  const depois = ANTES.replace('**Status:** rascunho', '**Status:** em revisão')
    .replace('`[LACUNA]` Porte.', '`[CANÔNICO]` Mede 3 m.\n\n`[PROPOSTA]` Penas douradas.');
  const { frases, assunto } = explicarMudanca(ANTES, depois);
  assert.ok(frases.includes('Status: rascunho → em revisão.'));
  const car = frases.find((f) => f.startsWith('Em Características'));
  assert.ok(car, frases.join(' | '));
  assert.match(car as string, /trecho novo/);
  assert.match(car as string, /\+1 CANÔNICO/);
  assert.match(car as string, /−1 LACUNA/);
  assert.equal(assunto, 'Grifo: atualiza características');
});

test('seção nova e removida', () => {
  const depois = ANTES.replace('## 2. Características\n\n`[LACUNA]` Porte.\n', '## 3. Comportamento\n\n`[CANÔNICO]` Caça.\n');
  const { frases } = explicarMudanca(ANTES, depois);
  assert.ok(frases.includes('Seção nova: Comportamento.'));
  assert.ok(frases.includes('Seção removida: Características.'));
});

test('sem mudança de conteúdo', () => {
  assert.deepEqual(explicarMudanca(ANTES, ANTES).frases, ['Só a data de atualização muda.']);
});
