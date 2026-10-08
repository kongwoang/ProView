import { OfferingPage } from '@/features/courses';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OfferingPage key={id} id={id} />;
}
