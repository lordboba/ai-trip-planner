import { PlannerShell } from "@/components/planner-shell";

export default function PlanPage() {
  return (
    <main className="min-h-screen bg-warm-900 flex flex-col items-center px-4 py-8 md:py-12">
      <PlannerShell />
    </main>
  );
}
