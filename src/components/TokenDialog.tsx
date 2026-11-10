'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { CAMINHO_COFRE, SENHA_MINIMA, abrirCofre, documentoDoCofre, fecharCofre } from '@/lib/breach/cofre';
import { GithubApiError, commitarArvore } from '@/lib/breach/github';
import { useAppearance } from './AppearanceProvider';
import { NOME_REPOSITORIO } from '@/lib/breach/repositorio';

interface Props {
  open: boolean;
  onClose: () => void;
  /** O cofre publicado no acervo: o token cifrado pela senha do Criador. */
  cofre?: string | null;
}

const FOCAVEIS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo do token pessoal — a porta do modo administrador. Clona a casca de
 * `SearchDialog`, mas corrige três buracos que o original tem: aqui o Escape
 * funciona com foco em qualquer parte do painel (não só no campo), o Tab fica
 * preso dentro do diálogo, e a rolagem do corpo trava enquanto ele está aberto.
 */
export function TokenDialog({ open, onClose, cofre = null }: Props) {
  const { token, activate, deactivate } = useAppearance();
  const [valor, setValor] = useState('');
  /** Sem token e com cofre publicado, a porta é a senha; o token é o plano B. */
  const [porToken, setPorToken] = useState(false);
  const [senha, setSenha] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValor('');
    setSenha('');
    setSenhaNova('');
    setAviso('');
    setPorToken(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, token]);

  useEffect(() => {
    if (!open) return undefined;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focaveis = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCAVEIS));
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  const submeter = (event: React.FormEvent): void => {
    event.preventDefault();
    const limpo = valor.trim();
    if (!limpo) return;
    activate(limpo);
    onClose();
  };

  const entrarComSenha = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!cofre || !senha) return;
    setOcupado(true);
    setAviso('');
    const aberto = await abrirCofre(cofre, senha);
    setOcupado(false);
    if (!aberto) {
      setAviso('Senha errada.');
      return;
    }
    activate(aberto);
    onClose();
  };

  /** Cifra o token com a senha e publica o cofre no acervo. */
  const guardarSenha = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!token || senhaNova.length < SENHA_MINIMA) return;
    setOcupado(true);
    setAviso('');
    try {
      const fechado = await fecharCofre(token, senhaNova);
      await commitarArvore(
        [{ tipo: 'texto', path: CAMINHO_COFRE, conteudo: documentoDoCofre(fechado) }],
        'meta: cofre do editor',
        token,
      );
      setSenhaNova('');
      setAviso('Senha guardada. Em cerca de um minuto, o site passa a aceitá-la em qualquer aparelho.');
    } catch (error: unknown) {
      setAviso(error instanceof GithubApiError ? error.message : 'Não deu para guardar a senha.');
    } finally {
      setOcupado(false);
    }
  };

  const apagarSenha = async (): Promise<void> => {
    if (!token) return;
    setOcupado(true);
    setAviso('');
    try {
      await commitarArvore([{ tipo: 'remover', path: CAMINHO_COFRE }], 'meta: apaga o cofre do editor', token);
      setAviso('Senha apagada. Em cerca de um minuto, o site deixa de aceitá-la.');
    } catch (error: unknown) {
      setAviso(error instanceof GithubApiError ? error.message : 'Não deu para apagar a senha.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div
      className="searchdialog"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="searchdialog__panel tokendialog"
        role="dialog"
        aria-modal="true"
        aria-label="Modo administrador"
        onKeyDown={onKeyDown}
      >
        {token ? (
          <div className="tokendialog__body">
            <p className="tokendialog__estado">
              <ShieldCheck size={17} aria-hidden="true" />
              Token ativo, terminado em <code>…{token.slice(-4)}</code>
            </p>
            <p className="tokendialog__dica">
              Vale para <code>{NOME_REPOSITORIO}</code>. Sair apaga o token deste navegador.
            </p>
            <form className="tokendialog__senha" onSubmit={(event) => void guardarSenha(event)}>
              <label className="tokendialog__rotulo" htmlFor="senha-nova">
                <KeyRound size={14} aria-hidden="true" /> {cofre ? 'Trocar a senha' : 'Entrar com senha nos outros aparelhos'}
              </label>
              <input
                id="senha-nova"
                type="password"
                autoComplete="new-password"
                value={senhaNova}
                onChange={(event) => setSenhaNova(event.target.value)}
                placeholder={`uma frase de ${SENHA_MINIMA} letras ou mais`}
              />
              <p className="tokendialog__dica">
                O token é cifrado com a senha e publicado junto do site; quem souber a senha entra. O cofre fica à
                vista de qualquer visitante, então use uma frase longa, que não sirva em mais lugar nenhum.
              </p>
              <button type="submit" className="tokendialog__ativar" disabled={ocupado || senhaNova.length < SENHA_MINIMA}>
                {ocupado ? 'Guardando…' : 'Guardar a senha'}
              </button>
              {cofre ? (
                <button type="button" className="tokendialog__sair" disabled={ocupado} onClick={() => void apagarSenha()}>
                  Apagar a senha
                </button>
              ) : null}
            </form>
            {aviso ? (
              <p className="tokendialog__dica" role="status">
                {aviso}
              </p>
            ) : null}
            <button
              type="button"
              className="tokendialog__sair"
              onClick={() => {
                deactivate();
                onClose();
              }}
            >
              <LogOut size={16} aria-hidden="true" />
              Sair do modo administrador
            </button>
          </div>
        ) : cofre && !porToken ? (
          <form className="tokendialog__body" onSubmit={(event) => void entrarComSenha(event)}>
            <label className="tokendialog__rotulo" htmlFor="senha">
              Senha do modo administrador
            </label>
            <input
              ref={inputRef}
              id="senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
            {aviso ? (
              <p className="tokendialog__dica" role="alert">
                {aviso}
              </p>
            ) : null}
            <button type="submit" className="tokendialog__ativar" disabled={ocupado || !senha}>
              {ocupado ? 'Abrindo…' : 'Entrar'}
            </button>
            <button type="button" className="tokendialog__sair" onClick={() => setPorToken(true)}>
              Entrar com o token
            </button>
          </form>
        ) : (
          <form className="tokendialog__body" onSubmit={submeter}>
            <label className="tokendialog__rotulo" htmlFor="gh-token">
              Token pessoal do GitHub
            </label>
            <input
              ref={inputRef}
              id="gh-token"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={valor}
              onChange={(event) => setValor(event.target.value)}
              placeholder="github_pat_…"
            />
            <p className="tokendialog__dica">
              Fine-grained, restrito a <code>{NOME_REPOSITORIO}</code>, com permissão{' '}
              <code>Contents: Read and write</code>. Fica só neste navegador.
            </p>
            <button type="submit" className="tokendialog__ativar" disabled={!valor.trim()}>
              Ativar modo administrador
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
