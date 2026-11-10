import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompendium, getGeradoEm } from '@/lib/breach/api';
import { EditarLink } from '@/components/EditarLink';
import { AlternarAtelie } from '@/components/atelie/AlternarAtelie';
import { DocArticle, MarkerLegend, PageHead } from '@/components/content';

export const metadata: Metadata = {
  title: 'Convenções',
  description: 'Regras de escrita válidas para todo o acervo: marcadores, fontes internas e modelo de documento.',
};

export default async function ConventionsPage() {
  const compendium = await getCompendium();
  const geradoEm = await getGeradoEm();
  const publicos = compendium.docs.map((d) => d.path);
  const doc = compendium.conventions;
  if (!doc) notFound();

  return (
    <div>
      <PageHead
        eyebrow="00-meta"
        title={doc.title}
        lede={doc.excerpt}
      >
        <div className="pagehead__acoes">
          <EditarLink path="00-meta/CONVENCOES.md" />
        </div>
      </PageHead>
      <div className="panel" style={{ marginBottom: 'var(--space-7)' }}>
        <p className="panel__title">Os sete marcadores</p>
        <MarkerLegend />
      </div>
      <AlternarAtelie path="00-meta/CONVENCOES.md" publicos={publicos} geradoEm={geradoEm}>
        <DocArticle doc={doc} semIntro />
      </AlternarAtelie>
    </div>
  );
}
