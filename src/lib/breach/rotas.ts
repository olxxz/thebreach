/**
 * Rotas do site que outras partes precisam conhecer sem carregar o compêndio —
 * a casca, que roda no navegador, também aponta para elas.
 */

import { hrefForPath } from './slug';

/** Documento do acervo que guarda a cronologia. */
export const CAMINHO_LINHA_DO_TEMPO = '06-historia/linha-do-tempo/README.md';

/** Página da linha do tempo no site. */
export const ROTA_LINHA_DO_TEMPO = hrefForPath(CAMINHO_LINHA_DO_TEMPO) ?? '/c/historia/linha-do-tempo';
