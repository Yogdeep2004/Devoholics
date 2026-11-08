import { BlueprintLibrary } from "@/components/blueprints/list";

export default function BlueprintsPage() {
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold tracking-tight">Architecture blueprints</h1>
        <p className="text-sm text-muted">Reusable, versioned starting points. Fork one to get an editable private copy instead of a blank canvas.</p></div>
      <BlueprintLibrary />
    </div>
  );
}
