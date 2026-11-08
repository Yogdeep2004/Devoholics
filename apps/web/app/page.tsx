import { Feed } from "@/components/feed";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">What&apos;s changing in the ecosystem</h1>
        <p className="mt-1 text-sm text-muted">
          Releases and maintenance signals from GitHub, package registries and the MCP registry. Ranking is transparent: open
          &ldquo;Why am I seeing this?&rdquo; on any card. Sign in to boost technologies you follow.
        </p>
      </div>
      <Feed />
    </div>
  );
}
