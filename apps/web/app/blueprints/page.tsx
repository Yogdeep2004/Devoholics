import { BlueprintLibrary } from "@/components/blueprints/list";

export default function BlueprintsPage() {
  return (
    <div className="space-y-8">
      <div><h1 className="display text-3xl">Blueprints</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">Reusable, versioned starting points. Fork one to get an editable private copy instead of a blank canvas.</p></div>
      <BlueprintLibrary />
    </div>
  );
}
