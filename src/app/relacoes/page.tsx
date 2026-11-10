import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getCompendium } from '@/lib/breach/api';
import { Grafo } from '@/components/mundo/Grafo';

export const metadata: Metadata = {
  title: 'Relações',
  description: 'O desenho das ligações entre os documentos do acervo: quem cita quem.',
};

export default async function RelacoesPage() {
  const { grafo, categories, eras } = await getCompendium();
  return (
    <div className="tela">
      <Suspense fallback={null}>
        <Grafo
          grafo={grafo}
          categorias={categories.map(({ slug, title }) => ({ slug, title }))}
          eras={eras.map(({ id, titulo }) => ({ id, titulo }))}
        />
      </Suspense>
    </div>
  );
}
