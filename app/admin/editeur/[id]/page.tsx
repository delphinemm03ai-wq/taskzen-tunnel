import { EditorRoute } from "@/components/editor/EditorRoute";

export const metadata = {
  title: "Éditeur de page | Taskzen Tunnel",
  robots: { index: false, follow: false },
};

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditorRoute pageId={id} />;
}
