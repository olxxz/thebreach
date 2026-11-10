import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisarRaiz, lerNomes, lerRaizes, raizBase } from '../src/lib/thalae/raizes';
import { lerLinhaDoTempo } from '../src/lib/breach/linhaDoTempo';

const THALAE = `## 3. Nomes

| Palavra | Fala | Celestial |
|---|---|---|
| Phae-lu (a Reveladora) | [Fái-lu](../x/pronuncia-phae-lu.mp3) | [celestial](../x/c.mp3) |

## 5. Raízes

**Cosmos**

| Raiz | Sentido | Raiz | Sentido |
|---|---|---|---|
| phae | brilho, glória | ir | vida |
| lu | ver | a- | prefixo: "aquele que…" |

### 5.1 Ordem das raízes

| Nome | Raízes | Sentido registrado | Pela regra |
|---|---|---|---|
| Phae-lu | phae · lu | "o brilho que vê" | segue |
| uph-’ìir | uph · ’ìir | "receber a vida" | segue |

## 6. Registro
`;

test('a raiz escrita vira os traços do selo', () => {
  assert.deepEqual(analisarRaiz('’ìir'), {
    texto: '’ìir', sentido: '', vogal: 'i', inspirado: true, tom: 'desce', longa: true, depois: ['r'],
  });
  assert.deepEqual(analisarRaiz('phae'), { texto: 'phae', sentido: '', vogal: 'a', acorde: true, antes: ['ph'] });
  assert.equal(analisarRaiz('lú').tom, 'sobe');
  assert.equal(analisarRaiz('myr').vogal, 'i');
  assert.deepEqual(analisarRaiz('mhi').antes, ['m', 'h']);
});

test('as raízes param na subseção da ordem; os nomes saem dela', () => {
  const raizes = lerRaizes(THALAE);
  assert.deepEqual(raizes.map((r) => r.texto), ['phae', 'ir', 'lu', 'a-']);
  assert.equal(raizes[3].sentido, 'aquele que…');
  const nomes = lerNomes(THALAE);
  assert.deepEqual(nomes[0], {
    nome: 'Phae-lu', raizes: ['phae', 'lu'], sentido: 'o brilho que vê', audio: '../x/pronuncia-phae-lu.mp3',
  });
  assert.equal(nomes[1].audio, null);
  assert.equal(raizBase('’ìir', raizes)?.texto, 'ir');
});

test('a linha do tempo dá as eras e os documentos de cada uma', async () => {
  const eras = await lerLinhaDoTempo(
    '## 2. As eras\n\n### 2.1 A criação\n\n- `[CANÔNICO]` Fato.\n\n**Documentos:** `01-cosmologia/o-criador.md`, `01-cosmologia/thalae/`\n\n### 2.2 O jardim\n\n## 3. Outra',
  );
  assert.deepEqual(eras.map((e) => [e.id, e.numero, e.documentos]), [
    ['era-a-criacao', '2.1', ['01-cosmologia/o-criador.md', '01-cosmologia/thalae/README.md']],
    ['era-o-jardim', '2.2', []],
  ]);
  assert.match(eras[0].html, /data-camada="canonico"/);
});
