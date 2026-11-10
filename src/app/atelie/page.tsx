import type { Metadata } from 'next';
import { getCompendium, getGeradoEm } from '@/lib/breach/api';
import { PaginaDoAtelie } from '@/components/atelie/PaginaDoAtelie';

export const metadata: Metadata = { title: 'Ateliê', robots: { index: false } };

export default async function AtelieRoute() {
  const { docs } = await getCompendium();
  return <PaginaDoAtelie publicos={docs.map((doc) => doc.path)} geradoEm={await getGeradoEm()} />;
}
