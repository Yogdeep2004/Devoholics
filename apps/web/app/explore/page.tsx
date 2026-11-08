import { Explore } from "@/components/explore";

export default function ExplorePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl">Explore</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">Search every tracked technology. Signals come from official APIs and show as missing when we don&apos;t have them.</p>
      </div>
      <Explore />
    </div>
  );
}
