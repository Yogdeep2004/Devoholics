import { Suspense } from "react";
import { Profile } from "@/components/profile";
import { Skeleton } from "@/components/ui";

async function Body({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Profile slug={slug} />;
}

export default function TechPage({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<Skeleton />}><Body params={params} /></Suspense>;
}
