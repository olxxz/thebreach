'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Maximize2, Minus, Plus } from 'lucide-react';
import type { Grafo as DadosDoGrafo } from '@/lib/breach/mundo';
import { accentFor } from '@/lib/layouts';

interface Props {
  grafo: DadosDoGrafo;
  categorias: Array<{ slug: string; title: string }>;
  eras: Array<{ id: string; titulo: string }>;
}

const LARGURA = 1000;
const ALTURA = 720;

interface Ponto {
  x: number;
  y: number;
}

/**
 * Disposição por forças, calculada de uma vez e sempre igual: cada documento
 * repele os outros, cada ligação puxa as pontas, e tudo é atraído de leve para
 * o centro. Começa num círculo ordenado por categoria, para que categorias
 * vizinhas tendam a ficar juntas.
 */
function dispor(grafo: DadosDoGrafo): Ponto[] {
  const n = grafo.nos.length;
  if (n === 0) return [];
  const ordem = grafo.nos
    .map((no, i) => ({ i, chave: `${no.categorySlug}/${no.path}` }))
    .sort((a, b) => a.chave.localeCompare(b.chave));
  const pos: Ponto[] = new Array(n);
  ordem.forEach(({ i }, k) => {
    const t = (k / n) * Math.PI * 2;
    pos[i] = { x: LARGURA / 2 + Math.cos(t) * 300, y: ALTURA / 2 + Math.sin(t) * 240 };
  });

  const k = Math.sqrt((LARGURA * ALTURA) / n) * 0.95;
  const passos = 320;
  for (let passo = 0; passo < passos; passo += 1) {
    const calor = 40 * (1 - passo / passos) + 0.6;
    const forca: Ponto[] = pos.map(() => ({ x: 0, y: 0 }));

    for (let a = 0; a < n; a += 1) {
      for (let b = a + 1; b < n; b += 1) {
        let dx = pos[a].x - pos[b].x;
        let dy = pos[a].y - pos[b].y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) {
          dx = (a % 7) - 3 + 0.5;
          dy = (b % 5) - 2 + 0.5;
          d = Math.hypot(dx, dy);
        }
        const f = (k * k) / d;
        forca[a].x += (dx / d) * f;
        forca[a].y += (dy / d) * f;
        forca[b].x -= (dx / d) * f;
        forca[b].y -= (dy / d) * f;
      }
    }
    for (const [a, b] of grafo.arestas) {
      const dx = pos[a].x - pos[b].x;
      const dy = pos[a].y - pos[b].y;
      const d = Math.max(Math.hypot(dx, dy), 0.01);
      const f = (d * d) / k;
      forca[a].x -= (dx / d) * f;
      forca[a].y -= (dy / d) * f;
      forca[b].x += (dx / d) * f;
      forca[b].y += (dy / d) * f;
    }
    for (let i = 0; i < n; i += 1) {
      // A gravidade segura junto os grupos que não se ligam ao resto.
      forca[i].x += (LARGURA / 2 - pos[i].x) * 1.4;
      forca[i].y += (ALTURA / 2 - pos[i].y) * 1.4;
      const m = Math.max(Math.hypot(forca[i].x, forca[i].y), 0.01);
      const andar = Math.min(m, calor);
      pos[i].x += (forca[i].x / m) * andar;
      pos[i].y += (forca[i].y / m) * andar;
    }
  }

  // O desenho pronto é esticado até ocupar o quadro inteiro.
  const xs = pos.map((p) => p.x);
  const ys = pos.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const margem = 56;
  for (const p of pos) {
    p.x = margem + ((p.x - x0) / Math.max(x1 - x0, 1)) * (LARGURA - margem * 2);
    p.y = margem + ((p.y - y0) / Math.max(y1 - y0, 1)) * (ALTURA - margem * 2);
  }
  return pos;
}

interface Vista {
  x: number;
  y: number;
  k: number;
}

const VISTA_INICIAL: Vista = { x: 0, y: 0, k: 1 };

export function Grafo({ grafo, categorias, eras }: Props) {
  const foco = useSearchParams().get('foco');
  const posicoes = useMemo(() => dispor(grafo), [grafo]);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [era, setEra] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>(VISTA_INICIAL);
  const svgRef = useRef<SVGSVGElement>(null);
  const dedos = useRef(new Map<number, Ponto>());
  const arrastou = useRef(false);

  useEffect(() => {
    if (!foco) return;
    const i = grafo.nos.findIndex((no) => no.path === foco);
    if (i !== -1) setSelecionado(i);
  }, [foco, grafo]);

  const vizinhos = useMemo(() => {
    const mapa = grafo.nos.map(() => new Set<number>());
    for (const [a, b] of grafo.arestas) {
      mapa[a].add(b);
      mapa[b].add(a);
    }
    return mapa;
  }, [grafo]);

  // Escolhido um documento, o quadro se aproxima dele e dos vizinhos: no
  // desenho inteiro os grupos mais ligados ficam apertados demais para ler.
  useEffect(() => {
    if (selecionado === null) return;
    const grupo = [selecionado, ...vizinhos[selecionado]].map((i) => posicoes[i]);
    const xs = grupo.map((p) => p.x);
    const ys = grupo.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const k = Math.min(3.2, Math.max(1, Math.min(LARGURA / (x1 - x0 + 220), ALTURA / (y1 - y0 + 180))));
    setVista({ k, x: LARGURA / 2 - ((x0 + x1) / 2) * k, y: ALTURA / 2 - ((y0 + y1) / 2) * k });
  }, [selecionado, vizinhos, posicoes]);

  const visivel = (i: number): boolean => {
    const no = grafo.nos[i];
    if (ocultas.has(no.categorySlug)) return false;
    return !era || no.eras.includes(era);
  };

  const ativo = sobre ?? selecionado;
  const emDestaque = (i: number): boolean =>
    ativo === null || i === ativo || vizinhos[ativo].has(i);

  const presentes = useMemo(() => {
    const slugs = new Set(grafo.nos.map((no) => no.categorySlug));
    return categorias.filter((c) => slugs.has(c.slug));
  }, [grafo, categorias]);

  /** Aproxima em torno de um ponto do desenho, para o zoom não fugir do dedo. */
  const aproximar = (fator: number, centro?: Ponto): void => {
    setVista((v) => {
      const k = Math.min(4, Math.max(0.6, v.k * fator));
      const c = centro ?? { x: LARGURA / 2, y: ALTURA / 2 };
      // O ponto `c` (em coordenadas do quadro) fica parado na tela.
      const mundo = { x: (c.x - v.x) / v.k, y: (c.y - v.y) / v.k };
      return { k, x: c.x - mundo.x * k, y: c.y - mundo.y * k };
    });
  };

  const noQuadro = (clientX: number, clientY: number): Ponto => {
    const caixa = svgRef.current?.getBoundingClientRect();
    if (!caixa) return { x: 0, y: 0 };
    return {
      x: ((clientX - caixa.left) / caixa.width) * LARGURA,
      y: ((clientY - caixa.top) / caixa.height) * ALTURA,
    };
  };

  // A roda precisa de um ouvinte não passivo para impedir a rolagem da página.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      aproximar(event.deltaY < 0 ? 1.15 : 1 / 1.15, noQuadro(event.clientX, event.clientY));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (event: React.PointerEvent): void => {
    dedos.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    arrastou.current = false;
  };

  const onPointerMove = (event: React.PointerEvent): void => {
    const antes = dedos.current.get(event.pointerId);
    if (!antes) return;
    const agora = { x: event.clientX, y: event.clientY };
    const caixa = svgRef.current?.getBoundingClientRect();
    const escala = caixa ? LARGURA / caixa.width : 1;

    if (dedos.current.size === 2) {
      const [outroId] = [...dedos.current.keys()].filter((id) => id !== event.pointerId);
      const outro = dedos.current.get(outroId) as Ponto;
      const dAntes = Math.hypot(antes.x - outro.x, antes.y - outro.y);
      const dAgora = Math.hypot(agora.x - outro.x, agora.y - outro.y);
      if (dAntes > 0) {
        aproximar(dAgora / dAntes, noQuadro((agora.x + outro.x) / 2, (agora.y + outro.y) / 2));
      }
      arrastou.current = true;
    } else {
      const dx = (agora.x - antes.x) * escala;
      const dy = (agora.y - antes.y) * escala;
      if (Math.abs(dx) + Math.abs(dy) > 1.5) arrastou.current = true;
      if (arrastou.current) {
        (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
        setVista((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      }
    }
    dedos.current.set(event.pointerId, agora);
  };

  const onPointerUp = (event: React.PointerEvent): void => {
    dedos.current.delete(event.pointerId);
  };

  const escolhido = selecionado === null ? null : grafo.nos[selecionado];
  const ligados =
    selecionado === null
      ? []
      : [...vizinhos[selecionado]]
          .map((i) => ({ i, no: grafo.nos[i] }))
          .sort((a, b) => a.no.title.localeCompare(b.no.title, 'pt-BR'));

  /** O verbo que liga o escolhido a um vizinho, na direção em que foi escrito. */
  const verboCom = (vizinho: number): string | null => {
    if (selecionado === null) return null;
    const vai = grafo.relacoes.find((r) => r.de === selecionado && r.para === vizinho);
    if (vai) return `${vai.verbo} →`;
    const vem = grafo.relacoes.find((r) => r.de === vizinho && r.para === selecionado);
    return vem ? `← ${vem.verbo}` : null;
  };
  const comNome = useMemo(
    () => new Set(grafo.relacoes.map((r) => (r.de < r.para ? `${r.de}-${r.para}` : `${r.para}-${r.de}`))),
    [grafo],
  );

  const maisLigados = useMemo(
    () =>
      grafo.nos
        .map((no, i) => ({ i, no, grau: vizinhos[i].size }))
        .sort((a, b) => b.grau - a.grau)
        .slice(0, 8),
    [grafo, vizinhos],
  );

  const tituloDaCategoria = (slug: string): string =>
    categorias.find((c) => c.slug === slug)?.title ?? slug;

  return (
    <div className="grafo">
      <section className="grafo__filtros" aria-label="Filtros do desenho">
      <h1 className="grafo__nome">Relações</h1>
      <p className="grafo__dica">Quem se liga a quem, pelas citações entre os documentos. Arraste, aproxime, toque num ponto.</p>
      <p className="grafo__rotulo">Categorias</p>
      <div className="filtros" role="group" aria-label="Categorias no desenho">
        {presentes.map((c) => (
          <button
            key={c.slug}
            type="button"
            className="filtro filtro--cor"
            style={{ ['--card-accent' as string]: accentFor(c.slug) }}
            aria-pressed={!ocultas.has(c.slug)}
            onClick={() =>
              setOcultas((atual) => {
                const novo = new Set(atual);
                if (novo.has(c.slug)) novo.delete(c.slug);
                else novo.add(c.slug);
                return novo;
              })
            }
          >
            {c.title}
          </button>
        ))}
      </div>
      {eras.length > 0 ? (
        <>
        <p className="grafo__rotulo">Era</p>
        <div className="filtros" role="group" aria-label="Era">
          <button type="button" className="filtro" aria-pressed={era === null} onClick={() => setEra(null)}>
            Todas as eras
          </button>
          {eras.map((e) => (
            <button
              key={e.id}
              type="button"
              className="filtro"
              aria-pressed={era === e.id}
              onClick={() => setEra(era === e.id ? null : e.id)}
            >
              {e.titulo}
            </button>
          ))}
        </div>
        </>
      ) : null}
      </section>

      <div className="grafo__bancada">
        <div className="grafo__quadro">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${LARGURA} ${ALTURA}`}
            role="img"
            aria-label="Desenho das ligações entre os documentos do acervo"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={() => {
              if (!arrastou.current) setSelecionado(null);
            }}
          >
            <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
              {grafo.arestas.map(([a, b]) => {
                if (!visivel(a) || !visivel(b)) return null;
                const forte = ativo !== null && (a === ativo || b === ativo);
                return (
                  <line
                    key={`${a}-${b}`}
                    className="grafo__aresta"
                    data-forte={forte}
                    data-nome={comNome.has(`${a}-${b}`)}
                    data-apagada={ativo !== null && !forte}
                    x1={posicoes[a].x}
                    y1={posicoes[a].y}
                    x2={posicoes[b].x}
                    y2={posicoes[b].y}
                    strokeWidth={(forte ? 1.6 : 0.8) / vista.k}
                  />
                );
              })}
              {grafo.nos.map((no, i) => {
                if (!visivel(i)) return null;
                const grau = vizinhos[i].size;
                const raio = (5 + Math.sqrt(grau) * 2.2) / Math.sqrt(vista.k);
                const destaque = emDestaque(i);
                const comRotulo = i === ativo || (ativo !== null && destaque) || grau >= 7 || vista.k >= 1.7;
                return (
                  <g
                    key={no.path}
                    className="grafo__no"
                    data-apagado={!destaque}
                    data-atual={i === selecionado}
                    transform={`translate(${posicoes[i].x} ${posicoes[i].y})`}
                    onPointerEnter={() => setSobre(i)}
                    onPointerLeave={() => setSobre(null)}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!arrastou.current) setSelecionado(i === selecionado ? null : i);
                    }}
                  >
                    <circle r={raio} style={{ fill: accentFor(no.categorySlug) }} />
                    {comRotulo ? (
                      <text y={-raio - 4 / vista.k} fontSize={12 / vista.k} textAnchor="middle">
                        {no.title}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </svg>
          <div className="grafo__zoom">
            <button type="button" onClick={() => aproximar(1.3)} aria-label="Aproximar">
              <Plus size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => aproximar(1 / 1.3)} aria-label="Afastar">
              <Minus size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setVista(VISTA_INICIAL)} aria-label="Ver tudo">
              <Maximize2 size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        <aside className="grafo__painel" aria-live="polite" data-escolhido={escolhido ? "sim" : "nao"}>
          {escolhido ? (
            <>
              {escolhido.capa ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="grafo__capa" src={escolhido.capa} alt="" />
              ) : null}
              <p className="pagehead__eyebrow">{tituloDaCategoria(escolhido.categorySlug)}</p>
              <h2 className="grafo__titulo">{escolhido.title}</h2>
              <Link className="reino__abrir" href={escolhido.href}>
                Abrir o documento <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <p className="grafo__rotulo">
                {ligados.length} ligaç{ligados.length === 1 ? 'ão' : 'ões'}
              </p>
              <ul className="grafo__lista">
                {[...ligados]
                  .sort((a, b) => Number(Boolean(verboCom(b.i))) - Number(Boolean(verboCom(a.i))))
                  .map(({ i, no }) => (
                  <li key={no.path}>
                    <button type="button" onClick={() => setSelecionado(i)}>
                      <span className="grafo__ponto" style={{ background: accentFor(no.categorySlug) }} />
                      {no.title}
                      {verboCom(i) ? <span className="grafo__verbo">{verboCom(i)}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="grafo__dica">
                Cada ponto é um documento; cada linha, uma citação entre dois deles. Toque num ponto para ver a quem
                ele se liga. Arraste para mover, use a roda ou dois dedos para aproximar.
              </p>
              <p className="grafo__rotulo">Os mais ligados</p>
              <ul className="grafo__lista">
                {maisLigados.map(({ i, no, grau }) => (
                  <li key={no.path}>
                    <button type="button" onClick={() => setSelecionado(i)}>
                      <span className="grafo__ponto" style={{ background: accentFor(no.categorySlug) }} />
                      {no.title}
                      <span className="grafo__grau">{grau}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
