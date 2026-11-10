'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ClipboardList, FolderInput, GitCompare, ImagePlus, Save, X } from 'lucide-react';
import { PageHead } from '@/components/content';
import { Cabecalho } from '@/components/Cabecalho';
import { DiffView } from '@/components/DiffView';
import { Ilustracoes, caminhoDeEntidade, mudancasDeImagem, type ImagemPronta } from '@/components/Ilustracoes';
import { MudarCaminho } from '@/components/MudarCaminho';
import { Previa } from '@/components/Previa';
import { EditorVisual, type EditorVisualRef } from '@/components/EditorVisual';
import { useAppearance } from '@/components/AppearanceProvider';
import { definirCampo, hoje } from '@/lib/breach/cabecalho';
import { conferirTexto } from '@/lib/breach/conferir';
import { comDiario } from '@/lib/breach/diario';
import {
  GithubApiError,
  commitarArvore,
  lerArquivo,
  lerBlob,
  listarArvore,
  type Gravacao,
  type Mudanca,
} from '@/lib/breach/github';
import {
  apagarRascunho,
  gravarRascunho,
  lerRascunho,
  quandoFoi,
  type Rascunho,
} from '@/lib/breach/rascunho';
import { EXTENSOES, NOME_HERO, pastaDe } from '@/lib/breach/imagens';
import { registrarGravado } from '@/lib/breach/recentes';
import { hrefForPath, parseCategoryDir, withBase } from '@/lib/breach/slug';
import { planejarMudanca } from '@/lib/breach/mover';
import { explicarMudanca } from '@/lib/breach/explicar';
import { tituloDoGravado } from '@/lib/breach/recentes';

/** O documento está aberto para edição, ou não chegou a abrir. */
type Estado = 'carregando' | 'aberto' | 'inacessivel';

/** Onde está a gravação: parada, a caminho, ou barrada por conflito. */
type EstadoGravacao = 'parada' | 'enviando' | 'conflito';

/** Espera antes de guardar o rascunho, para não escrever a cada tecla. */
const ESPERA_RASCUNHO = 800;

function Editor() {
  const path = useSearchParams().get('doc') ?? '';
  const { admin, token } = useAppearance();

  const [estado, setEstado] = useState<Estado>('carregando');
  const [gravacao, setGravacao] = useState<EstadoGravacao>('parada');
  const [erro, setErro] = useState('');

  // `original` é o que veio do GitHub: a base do diff e do teste de mudança.
  const [original, setOriginal] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [sha, setSha] = useState('');
  const [mensagem, setMensagem] = useState('');
  /** O que o Criador quer lembrar à revisão: vai para o diário do editor. */
  const [nota, setNota] = useState('');

  const [remoto, setRemoto] = useState<{ conteudo: string; sha: string } | null>(null);
  const [rascunhoAchado, setRascunhoAchado] = useState<Rascunho | null>(null);
  const [gravado, setGravado] = useState<Gravacao | null>(null);
  const [verDiff, setVerDiff] = useState(false);
  const [insistindo, setInsistindo] = useState(false);
  /**
   * O documento saiu daqui: este caminho não existe mais.
   *
   * Sem isto, o editor continua vivo apontando para um caminho morto, e gravar
   * recria ali o arquivo que a mudança acabou de tirar. Foi o que aconteceu com
   * a narrativa do dia 14.
   */
  const [mudouDeCaminho, setMudouDeCaminho] = useState<string | null>(null);

  // `undefined` enquanto carrega; `null` quando a conferência não está
  // disponível — o GitHub cortou a árvore, ou a chamada falhou.
  const [arvore, setArvore] = useState<Map<string, string> | null | undefined>(undefined);
  /** O markdown de todo o acervo, lido só quando a mudança de caminho precisa. */
  const [textos, setTextos] = useState<Map<string, string> | null>(null);
  const [lendoAcervo, setLendoAcervo] = useState(false);
  const [imagens, setImagens] = useState<ImagemPronta[]>([]);
  const [painel, setPainel] = useState<'nenhum' | 'ilustracoes' | 'caminho' | 'diff'>('nenhum');
  /** A ficha (o cabeçalho do documento), recolhida por padrão: o texto é o que importa. */
  const [fichaAberta, setFichaAberta] = useState(false);
  /** A janela de gravar: o que mudou, a explicação, a mensagem e a nota. */
  const [janela, setJanela] = useState(false);
  /** Visual: o documento editado no lugar. Markdown: o texto cru e a prévia. */
  const [modo, setModo] = useState<'visual' | 'markdown'>('visual');
  const visualRef = useRef<EditorVisualRef>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const folhaRef = useRef<HTMLDivElement>(null);
  /** Quem está conduzindo a rolagem agora, para os dois não se empurrarem. */
  const conduzindo = useRef<'area' | 'folha' | null>(null);

  // Quem só precisa saber o que existe recebe os caminhos; o sha só interessa a
  // quem move arquivo sem reenviar conteúdo.
  const arquivos = useMemo(() => (arvore ? new Set(arvore.keys()) : null), [arvore]);

  const sujo = conteudo !== original;

  // A mensagem de commit segue o CLAUDE.md do acervo: uma passagem por commit,
  // com o assunto na frente. O assunto sai do caminho, não da digitação.
  const prefixo = useMemo(() => {
    const categoria = parseCategoryDir(path.split('/')[0] ?? '');
    return categoria ? categoria.slug : null;
  }, [path]);

  /**
   * O texto que de fato vai para o acervo.
   *
   * O CLAUDE.md do acervo manda atualizar a data em cada documento tocado, e o
   * editor cumpre sozinho. Diff, conferência e `PUT` olham este mesmo texto, de
   * modo que a data aparece no diff antes de gravar e nunca é surpresa. O
   * carimbo só existe quando há mudança: abrir um documento não o suja.
   */
  const paraGravar = useMemo(
    () => (sujo ? definirCampo(conteudo, 'Última atualização', hoje()) : conteudo),
    [sujo, conteudo],
  );

  const achados = useMemo(
    () => (arquivos ? conferirTexto(path, paraGravar, arquivos) : []),
    [arquivos, path, paraGravar],
  );
  const barrado = achados.length > 0 && !insistindo;

  useEffect(() => {
    if (!path || !token) return undefined;
    let cancelado = false;
    setEstado('carregando');
    setErro('');

    lerArquivo(path, token)
      .then((arquivo) => {
        if (cancelado) return;
        if (!arquivo) {
          setErro(`${path} não existe no acervo.`);
          setEstado('inacessivel');
          return;
        }
        setOriginal(arquivo.conteudo);
        setConteudo(arquivo.conteudo);
        setSha(arquivo.sha);
        setEstado('aberto');

        // O rascunho nunca se aplica sozinho: aplicá-lo esconderia do Criador o
        // que está de fato no acervo. Ele é anunciado, e ele decide.
        const guardado = lerRascunho(path);
        if (guardado && guardado.conteudo !== arquivo.conteudo) setRascunhoAchado(guardado);
        else if (guardado) apagarRascunho(path);
      })
      .catch((error: unknown) => {
        if (cancelado) return;
        setErro(error instanceof GithubApiError ? error.message : 'Falha ao falar com o GitHub.');
        setEstado('inacessivel');
      });

    return () => {
      cancelado = true;
    };
  }, [path, token]);

  // A lista de arquivos do acervo, buscada uma vez: serve à conferência e à
  // ilustração de abertura da prévia.
  useEffect(() => {
    if (!token) return undefined;
    let cancelado = false;
    listarArvore(token)
      .then((lista) => {
        if (!cancelado) setArvore(lista);
      })
      .catch(() => {
        if (!cancelado) setArvore(null);
      });
    return () => {
      cancelado = true;
    };
  }, [token]);

  // O rascunho só é escrito, nunca apagado aqui: depois de um conflito ele é a
  // única cópia do que foi digitado, e apagá-lo por conta própria perderia tudo.
  useEffect(() => {
    if (estado !== 'aberto' || !sujo) return undefined;
    const tempo = window.setTimeout(() => {
      gravarRascunho(path, { sha, conteudo, mensagem, em: Date.now() });
    }, ESPERA_RASCUNHO);
    return () => window.clearTimeout(tempo);
  }, [estado, sujo, path, sha, conteudo, mensagem]);

  /**
   * A rolagem da área de texto e a da prévia andam juntas, por proporção.
   *
   * Proporção e não linha a linha: mapear a linha do markdown para o elemento
   * que ela virou exigiria marcar cada nó no pipeline, e para um documento
   * destes a proporção acerta o bastante. Só vale lado a lado — empilhado, cada
   * um rola com a página.
   */
  useEffect(() => {
    const area = areaRef.current;
    const folha = folhaRef.current;
    if (!area || !folha || estado !== 'aberto') return undefined;

    const casar = (de: HTMLElement, para: HTMLElement, quem: 'area' | 'folha') => () => {
      if (conduzindo.current && conduzindo.current !== quem) return;
      conduzindo.current = quem;
      const curso = de.scrollHeight - de.clientHeight;
      const destino = para.scrollHeight - para.clientHeight;
      if (curso > 0 && destino > 0) para.scrollTop = (de.scrollTop / curso) * destino;
      // Solta o comando no quadro seguinte: a rolagem que acabamos de impor
      // dispara o evento do outro lado, e sem isto os dois se empurrariam.
      requestAnimationFrame(() => {
        conduzindo.current = null;
      });
    };

    const daArea = casar(area, folha, 'area');
    const daFolha = casar(folha, area, 'folha');
    area.addEventListener('scroll', daArea, { passive: true });
    folha.addEventListener('scroll', daFolha, { passive: true });
    return () => {
      area.removeEventListener('scroll', daArea);
      folha.removeEventListener('scroll', daFolha);
    };
  }, [estado, modo]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem('breach:editor') === 'markdown') setModo('markdown');
    } catch {
      /* navegação privada: fica no visual */
    }
  }, []);

  const escolherModo = (novo: 'visual' | 'markdown'): void => {
    setModo(novo);
    try {
      window.localStorage.setItem('breach:editor', novo);
    } catch {
      /* a escolha vale só para esta visita */
    }
  };

  useEffect(() => {
    // Depois de gravar, não há o que perder: o aviso do navegador só atrapalha,
    // e atrapalhar aqui significa ficar preso num caminho que não existe mais.
    if (!sujo || mudouDeCaminho) return undefined;
    const avisar = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sujo, mudouDeCaminho]);

  if (!path) {
    return (
      <PageHead eyebrow="Ateliê" title="Editar">
        <p className="editor__estado">
          Falta o documento: abra esta página a partir do link “Editar” de uma entidade.
        </p>
      </PageHead>
    );
  }

  if (!admin || !token) {
    return (
      <PageHead eyebrow="Ateliê" title={path}>
        <p className="editor__estado">
          Fora do Ateliê. Aperte <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>A</kbd> para colar o
          token e ativar.
        </p>
      </PageHead>
    );
  }

  /** Uma mudança no texto, venha da área de texto ou do formulário. */
  const mudar = (novo: string): void => {
    setConteudo(novo);
    setGravado(null);
    setInsistindo(false);
  };

  /** Enfia um trecho onde o cursor está — é como a citação da imagem entra. */
  const inserirNoCursor = (trecho: string): void => {
    if (modo === 'visual') {
      visualRef.current?.inserir(trecho);
      return;
    }
    const area = areaRef.current;
    const corte = area ? area.selectionStart : conteudo.length;
    mudar(conteudo.slice(0, corte) + trecho + conteudo.slice(corte));
    requestAnimationFrame(() => {
      if (!area) return;
      const fim = corte + trecho.length;
      area.focus();
      area.setSelectionRange(fim, fim);
    });
  };

  /**
   * Lê o markdown do acervo inteiro. Só a mudança de caminho precisa disto —
   * para saber quem cita o que vai sair do lugar não há atalho.
   */
  const lerAcervo = async (): Promise<Map<string, string> | null> => {
    if (!arvore) return null;
    if (textos) return textos;
    setLendoAcervo(true);
    setErro('');
    try {
      const mds = [...arvore.entries()].filter(([caminho]) => caminho.toLowerCase().endsWith('.md'));
      const lidos = await Promise.all(
        mds.map(async ([caminho, blobSha]) => [caminho, await lerBlob(blobSha, token)] as const),
      );
      const mapa = new Map(lidos);
      setTextos(mapa);
      return mapa;
    } catch (error: unknown) {
      setErro(error instanceof GithubApiError ? error.message : 'Falha ao ler o acervo.');
      return null;
    } finally {
      setLendoAcervo(false);
    }
  };

  /**
   * Grava um punhado de arquivos como um commit só, e leva para o documento no
   * lugar novo quando ele mudou de caminho.
   */
  const gravarEmArvore = async (
    mudancas: Mudanca[],
    mensagemDoCommit: string,
    destino: string,
  ): Promise<void> => {
    setGravacao('enviando');
    setErro('');
    setGravado(null);
    try {
      const comRegistro = await comDiario(mudancas, mensagemDoCommit, token, {
        acao: destino !== path ? 'mudança de caminho' : 'edição',
        principal: path,
        destino,
        antes: original,
        nota,
      });
      const feito = await commitarArvore(comRegistro, mensagemDoCommit, token);
      setNota('');
      // Cada documento que entrou no commit fica visível no próprio navegador
      // enquanto a publicação não alcança.
      for (const mudanca of mudancas) {
        if (mudanca.tipo !== 'texto' || !mudanca.path.toLowerCase().endsWith('.md')) continue;
        registrarGravado(mudanca.path, {
          conteudo: mudanca.conteudo,
          em: Date.now(),
          commitUrl: feito.commitUrl,
        });
      }
      setGravado(feito);
      setJanela(false);
      setGravacao('parada');
      setPainel('nenhum');
      setImagens([]);
      setTextos(null);
      setInsistindo(false);
      apagarRascunho(path);

      if (destino !== path) {
        // Primeiro desarma o aviso de saída, depois navega. Na ordem inversa o
        // navegador pergunta "sair do site?", o Criador diz não — e fica num
        // caminho morto com o editor ainda aceitando escrita.
        setMudouDeCaminho(destino);
        setOriginal(conteudo);
        window.location.search = `?doc=${encodeURIComponent(destino)}`;
        return;
      }

      setArvore(await listarArvore(token));
      {
        const atual = await lerArquivo(path, token);
        if (atual) {
          setOriginal(atual.conteudo);
          setConteudo(atual.conteudo);
          setSha(atual.sha);
        }
      }
    } catch (error: unknown) {
      setErro(error instanceof GithubApiError ? error.message : 'Falha ao falar com o GitHub.');
      setGravacao('parada');
    }
  };

  const enviar = async (shaAlvo: string): Promise<void> => {
    const texto = mensagem.trim();
    if (!texto) return;
    const enviado = paraGravar;
    const mensagemCompleta = prefixo ? `${prefixo}: ${texto}` : texto;

    // Com imagem escolhida, o texto e os arquivos entram no mesmo commit: a
    // citação e a imagem que ela cita nunca chegam separadas ao acervo.
    if (temImagem && viraPasta) {
      // Documento solto com ilustração: vira entidade no mesmo commit. As
      // imagens já estão na pasta nova; o texto e as citações de quem o cita
      // seguem o plano de mudança de caminho.
      const destino = caminhoDeEntidade(path);
      const acervoTextos = await lerAcervo();
      if (!arvore || !acervoTextos) {
        setErro('Não deu para ler o acervo para virar pasta. Tente de novo.');
        return;
      }
      const comTela = new Map(acervoTextos);
      comTela.set(path, enviado);
      const plano = planejarMudanca(path, destino, arvore, comTela);
      if (plano.erro) {
        setErro(plano.erro);
        return;
      }
      const mudancas: Mudanca[] = [];
      for (const { de, para } of plano.arquivos) {
        if (plano.reescritos.has(para)) continue;
        const blobSha = arvore.get(de);
        if (blobSha) mudancas.push({ tipo: 'blob', path: para, sha: blobSha });
      }
      for (const [caminho, texto] of plano.reescritos) mudancas.push({ tipo: 'texto', path: caminho, conteudo: texto });
      for (const { de } of plano.arquivos) mudancas.push({ tipo: 'remover', path: de });
      mudancas.push(...mudancasDeImagem(imagens, heroAtual));
      await gravarEmArvore(mudancas, mensagemCompleta, destino);
      setMensagem('');
      return;
    }

    if (temImagem) {
      const mudancas: Mudanca[] = [
        { tipo: 'texto', path, conteudo: enviado },
        ...mudancasDeImagem(imagens, heroAtual),
      ];
      await gravarEmArvore(mudancas, mensagemCompleta, path);
      setMensagem('');
      return;
    }

    setGravacao('enviando');
    setErro('');
    setGravado(null);

    try {
      // O `sha` continua sendo o controle de concorrência: se o arquivo mudou
      // no GitHub desde que foi aberto, a gravação para antes de começar.
      const naPonta = await lerArquivo(path, token);
      if (naPonta && naPonta.sha !== shaAlvo) {
        throw new GithubApiError(409, `${path} mudou no GitHub depois que esta página o abriu.`);
      }
      // O texto e a entrada do diário entram no mesmo commit.
      const mudancas = await comDiario([{ tipo: 'texto', path, conteudo: enviado }], mensagemCompleta, token, {
        acao: 'edição',
        principal: path,
        antes: original,
        nota,
      });
      const commit = await commitarArvore(mudancas, mensagemCompleta, token);
      const gravadoAgora = await lerArquivo(path, token);
      const feito = { sha: gravadoAgora?.sha ?? shaAlvo, commitUrl: commit.commitUrl };
      setNota('');
      // O site leva cerca de um minuto para reconstruir. Até lá, a página de
      // leitura mostra a versão anterior — e sem isto pareceria que a gravação
      // não pegou.
      registrarGravado(path, { conteudo: enviado, em: Date.now(), commitUrl: feito.commitUrl });
      // O texto da tela passa a ser o que foi gravado, com a data já carimbada.
      setConteudo(enviado);
      setOriginal(enviado);
      setSha(feito.sha);
      setMensagem('');
      setRemoto(null);
      setRascunhoAchado(null);
      setVerDiff(false);
      setInsistindo(false);
      apagarRascunho(path);
      setGravado(feito);
      setJanela(false);
      setGravacao('parada');
    } catch (error: unknown) {
      if (error instanceof GithubApiError && error.conflito) {
        // O arquivo mudou no GitHub. Recarregar para mostrar o que mudou, e
        // deixar a decisão com o Criador — nunca passar por cima em silêncio.
        const atual = await lerArquivo(path, token).catch(() => null);
        if (atual) {
          setRemoto(atual);
          setGravacao('conflito');
          setErro(error.message);
          return;
        }
      }
      setErro(error instanceof GithubApiError ? error.message : 'Falha ao falar com o GitHub.');
      setGravacao('parada');
    }
  };

  /** Larga a edição da tela e volta ao que está no GitHub, guardando o texto. */
  const recarregarDoConflito = (): void => {
    if (!remoto) return;
    const meu: Rascunho = { sha, conteudo, mensagem, em: Date.now() };
    gravarRascunho(path, meu);
    setRascunhoAchado(meu);
    setOriginal(remoto.conteudo);
    setConteudo(remoto.conteudo);
    setSha(remoto.sha);
    setRemoto(null);
    setGravacao('parada');
    setErro('');
  };

  const enviando = gravacao === 'enviando';
  const temImagem = imagens.length > 0;
  const morto = mudouDeCaminho !== null;
  const viraPasta = !/(^|\/)README\.md$/i.test(path);
  // Com ilustração pendente, um documento solto já se comporta como a pasta
  // que vai ser: é onde as imagens moram e de onde as citações se resolvem.
  const caminhoEfetivo = temImagem && viraPasta ? caminhoDeEntidade(path) : path;
  const podeGravar = (sujo || temImagem) && mensagem.trim().length > 0 && !enviando && !morto;

  const heroAtual = arquivos
    ? EXTENSOES.map((ext) => {
        const pasta = pastaDe(caminhoDeEntidade(path));
        return `${pasta ? `${pasta}/` : ''}${NOME_HERO}.${ext}`;
      }).find((caminho) => arquivos.has(caminho)) ?? null
    : null;

  const explicacao = explicarMudanca(original, paraGravar);
  const titulo = tituloDoGravado(conteudo || original, path);
  const rotaDaPagina = hrefForPath(path);

  const abrirJanela = (): void => {
    if (!mensagem.trim()) setMensagem(explicacao.assunto);
    setJanela(true);
  };

  const alternarPainel = (qual: 'ilustracoes' | 'caminho' | 'diff'): void =>
    setPainel((atual) => (atual === qual ? 'nenhum' : qual));

  const botaoDaBarra = (
    qual: 'ilustracoes' | 'caminho' | 'diff',
    rotulo: string,
    Icone: typeof ImagePlus,
    desligado = false,
  ) => (
    <button
      type="button"
      className="editorbar__botao"
      aria-pressed={painel === qual}
      onClick={() => alternarPainel(qual)}
      disabled={desligado}
      title={rotulo}
    >
      <Icone size={16} aria-hidden="true" />
      <span>{rotulo}</span>
    </button>
  );

  return (
    <div className="editorpage">
      <header className="editorbar">
        <a className="editorbar__voltar" href={rotaDaPagina ? withBase(rotaDaPagina) : withBase('/atelie')} title="Voltar à página">
          <ArrowLeft size={17} aria-hidden="true" />
          <span className="editorbar__titulo">
            {titulo}
            <code>{caminhoEfetivo}</code>
          </span>
        </a>

        <div className="editorbar__grupo" role="group" aria-label="Modo de edição">
          <button type="button" className="editorbar__modo" aria-pressed={modo === 'visual'} onClick={() => escolherModo('visual')}>
            Visual
          </button>
          <button type="button" className="editorbar__modo" aria-pressed={modo === 'markdown'} onClick={() => escolherModo('markdown')}>
            Markdown
          </button>
        </div>

        <div className="editorbar__acoes">
          <button
            type="button"
            className="editorbar__botao"
            aria-pressed={fichaAberta}
            onClick={() => setFichaAberta((atual) => !atual)}
            title="Ficha do documento: classificação, status, relações"
          >
            <ClipboardList size={16} aria-hidden="true" />
            <span>Ficha</span>
          </button>
          {botaoDaBarra('ilustracoes', 'Ilustrações', ImagePlus)}
          {botaoDaBarra('caminho', 'Mudar caminho', FolderInput)}
          {botaoDaBarra('diff', 'O que muda', GitCompare, !sujo && !temImagem)}
          <button
            type="button"
            className="editorbar__gravar"
            onClick={abrirJanela}
            disabled={(!sujo && !temImagem) || enviando || morto || estado !== 'aberto'}
          >
            <Save size={16} aria-hidden="true" />
            {enviando ? 'Gravando…' : 'Gravar'}
          </button>
        </div>
      </header>

      {estado === 'carregando' ? <p className="editorpage__aviso">Carregando…</p> : null}
      {erro && !janela ? (
        <p className="editorpage__aviso editorpage__aviso--erro" role="alert">
          {erro}
        </p>
      ) : null}
      {morto ? (
        <p className="editorpage__aviso">
          Este documento passou a ser <code>{mudouDeCaminho}</code>. Abrindo o lugar novo…{' '}
          <a href={`?doc=${encodeURIComponent(mudouDeCaminho ?? '')}`}>ir agora</a>
        </p>
      ) : null}
      {gravado && !janela ? (
        <p className="editorpage__aviso editorpage__aviso--feito">
          Gravado no acervo.{' '}
          <a href={gravado.commitUrl} target="_blank" rel="noreferrer">
            Ver o commit
          </a>
          . Até o site publicar, este navegador mostra a versão nova como provisória.
        </p>
      ) : null}
      {rascunhoAchado && estado === 'aberto' && !morto ? (
        <div className="editorpage__aviso">
          <span>
            Há um rascunho deste documento, de {quandoFoi(rascunhoAchado.em)}.
            {rascunhoAchado.sha !== sha ? ' O arquivo mudou no GitHub depois que ele foi guardado.' : ''}
          </span>
          <button
            type="button"
            className="editor__botao"
            onClick={() => {
              mudar(rascunhoAchado.conteudo);
              setMensagem(rascunhoAchado.mensagem);
              setRascunhoAchado(null);
            }}
          >
            Recuperar
          </button>
          <button
            type="button"
            className="editor__botao editor__botao--fraco"
            onClick={() => {
              apagarRascunho(path);
              setRascunhoAchado(null);
            }}
          >
            Descartar
          </button>
        </div>
      ) : null}

      {estado === 'aberto' && !morto ? (
        <div className="editorpage__corpo">
          <div className="editorpage__folha">
            {fichaAberta ? (
              <div className="editorpage__ficha">
                <Cabecalho bruto={conteudo} onChange={mudar} somenteLeitura={enviando} />
              </div>
            ) : null}

            {modo === 'visual' ? (
              <EditorVisual
                ref={visualRef}
                texto={conteudo}
                onChange={mudar}
                path={caminhoEfetivo}
                arquivos={arquivos}
                pendentes={imagens}
                somenteLeitura={enviando}
              />
            ) : (
              <div className="editor__bancada">
                <textarea
                  ref={areaRef}
                  className="editor__area"
                  value={conteudo}
                  onChange={(event) => mudar(event.target.value)}
                  spellCheck
                  aria-label={`Markdown de ${path}`}
                  // `readOnly` e não `disabled`: no telefone, desabilitar o campo
                  // fecha o teclado e perde a posição da rolagem.
                  readOnly={enviando}
                />
                <Previa
                  bruto={paraGravar}
                  path={caminhoEfetivo}
                  arquivos={arquivos}
                  pendentes={imagens}
                  folhaRef={folhaRef}
                />
              </div>
            )}
          </div>

          {painel !== 'nenhum' ? (
            <aside className="editorpage__painel" aria-label="Painel do editor">
              <div className="editorpage__painel-topo">
                <p>{painel === 'ilustracoes' ? 'Ilustrações' : painel === 'caminho' ? 'Mudar caminho' : 'O que muda'}</p>
                <button type="button" className="editorbar__fechar" onClick={() => setPainel('nenhum')} aria-label="Fechar o painel">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              {painel === 'ilustracoes' ? (
                <Ilustracoes
                  path={path}
                  bruto={conteudo}
                  arquivos={arquivos}
                  pendentes={imagens}
                  onPendentes={setImagens}
                  onTexto={mudar}
                  onInserir={inserirNoCursor}
                />
              ) : null}
              {painel === 'caminho' ? (
                <MudarCaminho
                  key={path}
                  path={path}
                  textoAtual={paraGravar}
                  acervo={arvore ?? null}
                  textos={textos}
                  imagens={imagens}
                  heroAtual={heroAtual}
                  carregando={lendoAcervo}
                  onCarregar={() => void lerAcervo()}
                  onGravar={(mudancas, msg, destino) => void gravarEmArvore(mudancas, msg, destino)}
                />
              ) : null}
              {painel === 'diff' ? (
                <div className="painel__corpo">
                  <ul className="explicacao">
                    {explicacao.frases.map((frase) => (
                      <li key={frase}>{frase}</li>
                    ))}
                  </ul>
                  <DiffView antes={original} depois={paraGravar} />
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      ) : null}

      {janela ? (
        <div
          className="searchdialog"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !enviando) setJanela(false);
          }}
        >
          <div className="searchdialog__panel gravardialog" role="dialog" aria-modal="true" aria-label="Gravar no acervo">
            <div className="gravardialog__topo">
              <p className="gravardialog__titulo">Gravar no acervo</p>
              <button type="button" className="editorbar__fechar" onClick={() => setJanela(false)} aria-label="Fechar" disabled={enviando}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="gravardialog__corpo">
              <section>
                <p className="gravardialog__rotulo">O que mudou</p>
                <ul className="explicacao">
                  {explicacao.frases.map((frase) => (
                    <li key={frase}>{frase}</li>
                  ))}
                  {temImagem ? (
                    <li>
                      {imagens.length === 1 ? 'Uma imagem nova' : `${imagens.length} imagens novas`}
                      {viraPasta ? `; o documento vira ${caminhoDeEntidade(path)}` : ''}.
                    </li>
                  ) : null}
                </ul>
                <details className="gravardialog__linhas">
                  <summary>Ver as linhas</summary>
                  <DiffView antes={original} depois={paraGravar} />
                </details>
              </section>

              {erro ? (
                <p className="editor__estado editor__estado--erro" role="alert">
                  {erro}
                </p>
              ) : null}

              {gravacao === 'conflito' && remoto ? (
                <div className="editor__conflito">
                  <p className="editor__conflito-aviso">
                    O arquivo mudou no GitHub depois que esta página o abriu. Abaixo, o que está lá agora contra o
                    que está na sua tela.
                  </p>
                  <DiffView antes={remoto.conteudo} depois={paraGravar} rotulo={{ antes: 'no GitHub agora', depois: 'na sua tela' }} />
                  <div className="editor__acoes">
                    <button type="button" className="editor__botao" onClick={recarregarDoConflito}>
                      Recarregar do GitHub
                    </button>
                    <button type="button" className="editor__botao editor__botao--forte" onClick={() => void enviar(remoto.sha)}>
                      Gravar por cima
                    </button>
                  </div>
                </div>
              ) : null}

              {achados.length ? (
                <div className="editor__achados">
                  <p className="editor__achados-titulo">
                    {achados.length === 1
                      ? 'Uma referência aponta para o vazio:'
                      : `${achados.length} referências apontam para o vazio:`}
                  </p>
                  <ul>
                    {achados.map((achado) => (
                      <li key={achado.alvo}>
                        <code>{achado.escrita}</code> → <code>{achado.alvo}</code> não existe
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <label className="editor__mensagem">
                <span className="editor__rotulo">O que entrou no acervo</span>
                <span className="editor__campo">
                  {prefixo ? <span className="editor__prefixo">{prefixo}:</span> : null}
                  <input
                    type="text"
                    value={mensagem}
                    onChange={(event) => setMensagem(event.target.value)}
                    placeholder={explicacao.assunto}
                    readOnly={enviando}
                  />
                </span>
                <span className="editor__dica">Sugerido a partir do que mudou; reescreva à vontade.</span>
              </label>

              <label className="editor__mensagem">
                <span className="editor__rotulo">Nota para a revisão (opcional)</span>
                <span className="editor__campo">
                  <input
                    type="text"
                    value={nota}
                    onChange={(event) => setNota(event.target.value)}
                    placeholder="falta citar isto em Luora; conferir o índice"
                    readOnly={enviando}
                  />
                </span>
                <span className="editor__dica">Vai para o diário do editor, com o que mudou e o que falta conferir em volta.</span>
              </label>
            </div>

            <div className="gravardialog__acoes">
              <button type="button" className="editor__botao editor__botao--fraco" onClick={() => setJanela(false)} disabled={enviando}>
                Voltar a editar
              </button>
              <button
                type="button"
                className={`editor__botao ${barrado ? 'editor__botao--barrado' : 'editor__botao--forte'}`}
                onClick={() => (barrado ? setInsistindo(true) : void enviar(sha))}
                disabled={!podeGravar}
              >
                {enviando ? 'Gravando…' : barrado ? 'Gravar mesmo assim' : 'Gravar no acervo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function EditarPage() {
  return (
    <Suspense fallback={<PageHead eyebrow="Ateliê" title="Editar" />}>
      <Editor />
    </Suspense>
  );
}
