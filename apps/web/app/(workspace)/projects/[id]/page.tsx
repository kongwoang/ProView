import { ProjectPage } from '@/features/submissions';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectPage key={id} id={id} />;
}
