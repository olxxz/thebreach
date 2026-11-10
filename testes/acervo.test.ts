import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hrefForPath, looksLikeDocPath, relativizar, resolverRefRelativa } from '../src/lib/breach/slug';
import { parseMarkerToken, tallyMarkers } from '../src/lib/breach/markers';
import { referenciasDe } from '../src/lib/breach/mundo';
import { abrirCofre, documentoDoCofre, fecharCofre, lerDocumentoDoCofre } from '../src/lib/breach/cofre';
import { entradaDoDiario } from '../src/lib/breach/diario';

test('caminho do acervo vira rota do site', () => {
  assert.equal(hrefForPath('04-bestiario/repteis/dragoes/'), '/c/bestiario/repteis/dragoes');
  assert.equal(hrefForPath('01-cosmologia/o-criador.md'), '/c/cosmologia/o-criador');
  assert.equal(hrefForPath('00-meta/INDICE-CANONICO.md'), '/compendio');
  assert.equal(hrefForPath('00-meta/ARQUETIPOS.md'), null);
});

test('referência relativa resolve e desfaz', () => {
  assert.equal(resolverRefRelativa('01-cosmologia/deviantes/vaelu', '../../../02-geografia/luora/'), '02-geografia/luora/');
  assert.equal(resolverRefRelativa('01-cosmologia', 'https://exemplo.org'), null);
  assert.equal(relativizar('04-bestiario/aves/grifos/grifo-real', '04-bestiario/aves/grifos/cocatriz'), '../cocatriz');
  assert.equal(looksLikeDocPath('README.md'), false);
});

test('marcadores com e sem fonte', () => {
  assert.deepEqual(parseMarkerToken('[CRENÇA — povo de Luora]'), { id: 'CRENCA', label: 'CRENÇA', source: 'povo de Luora' });
  assert.equal(parseMarkerToken('[QUALQUER]'), null);
  assert.deepEqual(tallyMarkers('`[CANÔNICO]` a `[CANÔNICO — provisório]` b `[LACUNA]`'), { CANONICO: 2, LACUNA: 1 });
});

test('referências de um documento: links, crases, sem imagens nem cercas', () => {
  const existentes = new Set(['02-geografia/luora/README.md', '08-artefatos/brasa/README.md', '03-povos/primevos.md']);
  const md = [
    '![x](hero.webp) [Luora](../../02-geografia/luora/) e `08-artefatos/brasa/`',
    '```', '`03-povos/primevos.md`', '```', '`09-nada/existe/`',
  ].join('\n');
  assert.deepEqual(referenciasDe('01-cosmologia/x/README.md', md, existentes).sort(), [
    '02-geografia/luora/README.md', '08-artefatos/brasa/README.md',
  ]);
});

test('o cofre abre com a senha certa e só com ela', async () => {
  const cofre = lerDocumentoDoCofre(documentoDoCofre(await fecharCofre('github_pat_x', 'uma frase longa')));
  assert.ok(cofre);
  assert.equal(await abrirCofre(cofre, 'uma frase longa'), 'github_pat_x');
  assert.equal(await abrirCofre(cofre, 'outra frase'), null);
  assert.equal(lerDocumentoDoCofre('# sem cofre'), null);
});

test('a entrada do diário diz o que mudou e não cria referência entre crases', () => {
  const antes = '# T\n\n**Status:** rascunho\n\n## 1. Descrição\n\n`[LACUNA]` nada.\n';
  const depois = '# T\n\n**Status:** em revisão\n\n## 1. Descrição\n\n`[CANÔNICO]` algo, ver `08-artefatos/brasa/`.\n';
  const entrada = entradaDoDiario(
    [{ tipo: 'texto', path: '02-geografia/x/README.md', conteudo: depois }],
    'geografia: registra algo',
    { acao: 'edição', principal: '02-geografia/x/README.md', antes, nota: 'conferir o índice' },
  );
  assert.match(entrada, /Seções tocadas:\*\* .*1\. Descrição/);
  assert.match(entrada, /CANÔNICO \+1, LACUNA −1/);
  assert.match(entrada, /Referências novas:\*\* 08-artefatos\/brasa\//);
  assert.match(entrada, /Status: rascunho → em revisão/);
  assert.match(entrada, /Nota do Criador:\*\* conferir o índice/);
  // Fora do bloco de diff, nenhum caminho entre crases.
  assert.doesNotMatch(entrada.split('```diff')[0], /`\d{2}-/);
});

test('o campo Relações dá verbo e destino', async () => {
  const { toRelacoes } = await import('../src/lib/breach/parse');
  const lidas = toRelacoes(
    'governa [Luora](../../../02-geografia/luora/); serve a [Orlumm](../orlumm/); [sem verbo](../x/); —',
    '01-cosmologia/testemunhas-nefandas/orlumm',
  );
  assert.deepEqual(lidas.map((r) => [r.verbo, r.path, r.label]), [
    ['governa', '02-geografia/luora/README.md', 'Luora'],
    ['serve a', '01-cosmologia/testemunhas-nefandas/orlumm/README.md', 'Orlumm'],
  ]);
});
