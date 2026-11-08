import { Suspense } from "react";
import { Editor } from "@/components/playground/editor";
import { Skeleton } from "@/components/ui";

async function Body({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Editor id={id} />;
}

export default function PlaygroundEditorPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Skeleton />}><Body params={params} /></Suspense>;
}
