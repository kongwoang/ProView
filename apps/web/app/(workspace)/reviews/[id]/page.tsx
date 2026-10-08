import { ReviewEditorPage } from '@/features/reviews';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewEditorPage key={id} id={id} />;
}
