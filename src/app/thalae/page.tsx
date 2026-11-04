import Link from 'next/link';
import type { Metadata } from 'next';
import { PageHead } from '@/components/content';
import { Toc, type TocItem } from '@/components/Toc';
import { Selo } from '@/components/thalae/Selo';
import { LeitorDeSelo } from '@/components/thalae/LeitorDeSelo';
import { Exercicio } from '@/components/thalae/Exercicio';
import { EXERCICIO, PALAVRAS, audioDaThalae } from '@/lib/thalae/palavras';
import type { Raiz } from '@/lib/thalae/selo';

export const metadata: Metadata = {
  title: 'Aprender Thalae',
  description:
    'Como se fala e como se lê a língua celestial: tons, som inspirado, acorde vocálico, vogal longa, consoantes sopradas e a escrita em selo.',
};

/**
 * Aula da Thalae. As regras vêm de `01-cosmologia/thalae/` (§2 a §4); esta
 * página só as ensina em ordem, com os áudios e os selos ao lado. Mudou a
 * regra no acervo, muda aqui também.
 */

function Ouvir({ arquivo, children }: { arquivo: string; children: React.ReactNode }) {
  return (
    <button type="button" className="pronuncia" data-audio={audioDaThalae(arquivo)}>
      {children}
    </button>
  );
}

/** Um anel só, para mostrar como um fenômeno aparece na escrita. */
function Amostra({ raiz, legenda }: { raiz: Raiz; legenda: string }) {
  return (
    <figure className="aula__amostra">
      <Selo raizes={[raiz]} rotulo={legenda} />
      <figcaption>{legenda}</figcaption>
    </figure>
  );
}

const ITENS: TocItem[] = [
  { id: 'antes', label: 'Antes de começar', level: 2 },
  { id: 'tom', label: 'Tom', level: 2 },
  { id: 'longa', label: 'Vogal longa', level: 2 },
  { id: 'inspirado', label: 'Som inspirado', level: 2 },
  { id: 'acorde', label: 'Acorde vocálico', level: 2 },
  { id: 'soprada', label: 'Consoantes sopradas', level: 2 },
  { id: 'folego', label: 'Fôlego contínuo', level: 2 },
  { id: 'escrita', label: 'Escrita em selo', level: 2 },
  { id: 'leitura', label: 'Ler um selo', level: 2 },
  { id: 'exercicio', label: 'Exercício', level: 2 },
];

export default function AprenderThalaePage() {
  return (
    <div>
      <PageHead
        eyebrow="Cosmologia › língua"
        title="Aprender Thalae"
        lede="A língua dos celestiais é cantada e quase impossível para uma garganta humana. Aqui está o que dá para aprender: cada som, como ele se escreve e como se lê um selo."
      />

      <div className="doclayout">
        <article className="aula prose">
          <section id="antes">
            <h2>Antes de começar</h2>
            <p>
              A Thalae não é falada: é entoada. Celestiais não precisam de ar, então um nome inteiro sai num fôlego
              só, sem pausas. As letras que usamos aqui são só uma <b>transcrição</b>: aproximam sons que nenhum
              alfabeto dos povos tem. O documento completo está em{' '}
              <Link href="/c/cosmologia/thalae">Thalae — a língua celestial</Link>.
            </p>
            <p>
              São cinco vogais, como as nossas: <b>a, e, i, o, u</b>. As consoantes são suaves (l, m, n, r, s, v, h,
              y); k, g, t e d soltos não existem. O que torna a língua difícil são os cinco fenômenos abaixo.
            </p>
          </section>

          <section id="tom">
            <h2>Tom</h2>
            <p>
              A altura da voz muda o sentido da sílaba. <b>lú</b>, com a voz subindo, e <b>lù</b>, com a voz
              descendo, são palavras diferentes. Na transcrição, o acento agudo sobe e o grave desce.
            </p>
            <p className="aula__ouvir">
              <Ouvir arquivo="som-tom-sobe.mp3">lú — sobe</Ouvir>
              <Ouvir arquivo="som-tom-desce.mp3">lù — desce</Ouvir>
            </p>
            <p>
              <b>Como treinar:</b> diga a sílaba como uma pergunta (sobe) e depois como uma ordem (desce). No selo, o
              tom é um ponto: por fora do anel quando sobe, por dentro quando desce.
            </p>
            <div className="aula__amostras">
              <Amostra raiz={{ texto: 'lú', sentido: 'ver', vogal: 'u', antes: ['l'], tom: 'sobe' }} legenda="lú: ponto por fora" />
              <Amostra raiz={{ texto: 'lù', sentido: '', vogal: 'u', antes: ['l'], tom: 'desce' }} legenda="lù: ponto por dentro" />
            </div>
          </section>

          <section id="longa">
            <h2>Vogal longa</h2>
            <p>
              A duração também muda o sentido. <b>ir</b> e <b>iir</b> não são a mesma raiz. Na transcrição, a vogal
              longa se escreve dobrada.
            </p>
            <p className="aula__ouvir">
              <Ouvir arquivo="som-curta.mp3">ir — curta</Ouvir>
              <Ouvir arquivo="som-longa.mp3">iir — longa</Ouvir>
            </p>
            <p>
              <b>Como treinar:</b> segure a vogal pelo dobro do tempo sem mudar a altura. No selo, a vogal longa é o
              mesmo arco com traço grosso.
            </p>
            <div className="aula__amostras">
              <Amostra raiz={{ texto: 'ir', sentido: '', vogal: 'i', depois: ['r'] }} legenda="ir: traço fino" />
              <Amostra raiz={{ texto: 'iir', sentido: '', vogal: 'i', depois: ['r'], longa: true }} legenda="iir: traço grosso" />
            </div>
          </section>

          <section id="inspirado">
            <h2>Som inspirado</h2>
            <p>
              Alguns sons são ditos <b>puxando o ar</b>, não soltando. É o som mais estranho para um humano: a voz
              vem para dentro. Na transcrição, ele leva um apóstrofo antes: <b>’ìir</b>.
            </p>
            <p className="aula__ouvir">
              <Ouvir arquivo="som-inspirado.mp3">’ìir</Ouvir>
            </p>
            <p>
              <b>Como treinar:</b> comece a puxar o ar como num suspiro de susto e, sem parar, deixe a vogal sair. A
              voz sintética não consegue fazer isso; no áudio, o fôlego puxado vem logo antes da sílaba. No selo, o som
              inspirado é uma ponta voltada para o centro, no começo do arco.
            </p>
            <div className="aula__amostras">
              <Amostra
                raiz={{ texto: '’ìir', sentido: 'vida', vogal: 'i', depois: ['r'], inspirado: true }}
                legenda="’ìir: ponta para o centro"
              />
            </div>
          </section>

          <section id="acorde">
            <h2>Acorde vocálico</h2>
            <p>
              Duas vogais <b>ao mesmo tempo</b>, como dois tons cantados juntos. Não é uma vogal depois da outra: as
              duas soam juntas. Na transcrição, um ponto no meio: <b>a·e</b>.
            </p>
            <p className="aula__ouvir">
              <Ouvir arquivo="som-vogal-a.mp3">a</Ouvir>
              <Ouvir arquivo="som-vogal-e.mp3">e</Ouvir>
              <Ouvir arquivo="som-acorde.mp3">a·e — juntas</Ouvir>
            </p>
            <p>
              <b>Como treinar:</b> uma garganta só não faz isso. O mais perto é deslizar de uma vogal à outra muito
              depressa, ou cantar em dupla, uma voz em cada vogal. No selo, o acorde é um segundo arco, fino e
              paralelo, por fora.
            </p>
            <div className="aula__amostras">
              <Amostra raiz={{ texto: 'ha·e', sentido: 'sopro', vogal: 'a', antes: ['h'], acorde: true }} legenda="ha·e: arco paralelo" />
            </div>
          </section>

          <section id="soprada">
            <h2>Consoantes sopradas</h2>
            <p>
              Quatro consoantes saem com ar escapando junto: <b>ph</b> (soa como f), <b>th</b> (um t soprado),{' '}
              <b>rh</b> (um r forte) e <b>vh</b>. Compare com uma sílaba seca:
            </p>
            <p className="aula__ouvir">
              <Ouvir arquivo="som-simples-t.mp3">dá — seca</Ouvir>
              <Ouvir arquivo="som-soprada-ph.mp3">pha</Ouvir>
              <Ouvir arquivo="som-soprada-th.mp3">tha</Ouvir>
              <Ouvir arquivo="som-soprada-rh.mp3">rha</Ouvir>
            </p>
            <p>
              <b>Como treinar:</b> segure uma folha de papel diante da boca; nas sopradas ela tem de se mexer. No selo,
              ph e th são uma cruz sobre o arco; rh é a corcova do r com um risco de sopro.
            </p>
            <div className="aula__amostras">
              <Amostra raiz={{ texto: 'tha', sentido: 'palavra', vogal: 'a', antes: ['th'] }} legenda="tha: cruz no começo" />
              <Amostra raiz={{ texto: 'rhe', sentido: 'sangue', vogal: 'e', antes: ['rh'] }} legenda="rhe: corcova com sopro" />
            </div>
          </section>

          <section id="folego">
            <h2>Fôlego contínuo</h2>
            <p>
              Tudo junto, sem respirar. Um nome verdadeiro de Nefando tem sete raízes e esgota o ar de qualquer
              humano antes do fim. A versão &quot;celestial&quot; soma à voz uma quinta acima e uma oitava abaixo,
              para sugerir o canto.
            </p>
            <p className="aula__ouvir">
              <Ouvir arquivo="pronuncia-nome-verdadeiro.mp3">Sàv-om-’ìir-rhe-ith-lú-ha·e</Ouvir>
              <Ouvir arquivo="pronuncia-nome-verdadeiro-celestial.mp3">celestial</Ouvir>
            </p>
          </section>

          <section id="escrita">
            <h2>Escrita em selo</h2>
            <p>Um nome não se escreve em linha. Ele vira uma figura só, o selo, desenhado num traço contínuo:</p>
            <ol>
              <li>Começa no <b>ponto do centro</b>, a origem, e sobe até o primeiro anel.</li>
              <li>Cada <b>raiz</b> é um anel; o primeiro anel é a primeira raiz.</li>
              <li>
                A <b>vogal</b> da raiz é o comprimento do arco: a 300°, e 250°, i 200°, o 150°, u 100°.
              </li>
              <li>
                As <b>consoantes</b> são marcas sobre o arco: as que vêm antes da vogal perto do começo, as que vêm
                depois perto do fim.
              </li>
              <li>Ao fim de cada anel, um traço reto leva ao seguinte. O nome termina num pequeno círculo aberto.</li>
              <li>
                O selo de um <b>caído</b> é rachado: a queda abriu uma fratura de um lado a outro. Ela se vê, mas não
                se ouve.
              </li>
            </ol>
          </section>

          <section id="leitura">
            <h2>Ler um selo</h2>
            <p>Escolha um nome e leia anel por anel, do centro para fora.</p>
          </section>
          <LeitorDeSelo palavras={PALAVRAS} />

          <section id="exercicio">
            <h2>Exercício</h2>
            <p>Leia este selo sozinho antes de ver a resposta.</p>
          </section>
          <Exercicio palavra={EXERCICIO} />
        </article>

        <Toc items={ITENS} />
      </div>
    </div>
  );
}
