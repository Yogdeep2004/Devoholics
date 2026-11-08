import { Feed } from "@/components/feed";
import { Hero, Stats } from "@/components/hero";
import { Trending } from "@/components/trending";

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <Trending />
      <section aria-labelledby="signals" className="space-y-6">
        <div>
          <h2 id="signals" className="display text-2xl">Latest signals</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">Releases and maintenance changes across the ecosystem. Every ranking is explained on the card.</p>
        </div>
        <Feed />
      </section>
    </>
  );
}
