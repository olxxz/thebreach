import type { Metadata } from 'next';
import { getCompendium } from '@/lib/breach/api';
import { PageHead } from '@/components/content';
import { Galeria } from '@/components/mundo/Galeria';

export const metadata: Metadata = {
  title: 'Galeria',
  description: 'Todas as ilustrações do acervo, por categoria.',
};

export default async function GaleriaPage() {
  const { galeria, categories } = await getCompendium();
  return (
    <div className="stack">
      <PageHead
        eyebrow="Explorar"
        title="Galeria"
        lede="Todas as ilustrações do acervo num lugar só. Cada uma leva ao documento a que pertence."
      />
      <Galeria imagens={galeria} categorias={categories.map(({ slug, title }) => ({ slug, title }))} />
    </div>
  );
}
