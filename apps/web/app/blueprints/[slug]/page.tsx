import { Suspense } from "react";
import { BlueprintPage } from "@/components/blueprints/detail";
import { Skeleton } from "@/components/ui";

async function Body({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BlueprintPage slug={slug} />;
}

export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<Skeleton />}><Body params={params} /></Suspense>;
}
