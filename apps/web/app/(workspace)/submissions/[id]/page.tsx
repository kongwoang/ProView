import { SubmissionPage } from '@/features/submissions';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubmissionPage key={id} id={id} />;
}
