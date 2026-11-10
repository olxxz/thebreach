import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { FolderOpen, ScrollText } from 'lucide-react';
import { getCategories, getCategory, getCompendium, getGeradoEm, getResumos } from '@/lib/breach/api';
import { ListaDeDocumentos } from '@/components/ListaDeDocumentos';
import { Chip, Crumbs, Hero, PageHead } from '@/components/content';
import { CriarLink } from '@/components/CriarLink';
import { EditarLink } from '@/components/EditarLink';
import { AlternarAtelie } from '@/components/atelie/AlternarAtelie';

type Params = { categoria: string };

export async function generateStaticParams(): Promise<Params[]> {
  const categories = await getCategories();
  return categories.map((category) => ({ categoria: category.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categoria } = await params;
  const category = await getCategory(categoria);
  if (!category) return { title: 'Categoria não encontrada' };
  return { title: category.title, description: category.description };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { categoria } = await params;
  const category = await getCategory(categoria);
  if (!category) notFound();
  const [resumos, { eras, docs }, geradoEm] = await Promise.all([getResumos(category.tree), getCompendium(), getGeradoEm()]);

  return (
    <div className="stack">
      {category.hero ? <Hero src={category.hero} alt={`Ilustração — ${category.title}`} /> : null}
      <div>
        <Crumbs trail={[{ href: '/', label: 'Compêndio' }, { label: category.title }]} />
        <PageHead eyebrow={`Categoria ${category.number}`} title={category.title} lede={category.description}>
          <div className="chips">
            <Chip label="Status" value={category.status} status />
            <Chip
              label="Documentos"
              value={String(category.docs.length)}
              icon={<FolderOpen size={13} aria-hidden="true" />}
            />
            {category.updatedAt ? <Chip label="Atualizado" value={category.updatedAt} /> : null}
          </div>
          {/* O índice da categoria é um documento como os outros (§6), e uma
              categoria sempre agrupa entidades. */}
          <div className="pagehead__acoes">
            <EditarLink path={`${category.dir}/README.md`} />
            <CriarLink pasta={category.dir} />
          </div>
        </PageHead>
        <AlternarAtelie path={`${category.dir}/README.md`} publicos={docs.map((doc) => doc.path)} geradoEm={geradoEm}>
          {null}
        </AlternarAtelie>
      </div>

      <section>
        <div className="section-title">
          <h2>Documentos</h2>
        </div>
        {category.docs.length > 0 ? (
          <ListaDeDocumentos nodes={resumos} eras={eras.map(({ id, titulo }) => ({ id, titulo }))} />
        ) : (
          <p className="empty">
            Categoria ainda vazia. Nenhum documento foi aberto aqui — nada é inventado para preencher.
          </p>
        )}
      </section>

      {category.gaps.length > 0 ? (
        <section className="panel">
          <p className="panel__title">
            <ScrollText size={13} aria-hidden="true" /> Lacunas desta categoria
          </p>
          <ul className="prose">
            {category.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
