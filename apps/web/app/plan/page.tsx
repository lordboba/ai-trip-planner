import { PlannerShell } from "@/components/planner-shell";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{
    googleCalendar?: string;
    startDate?: string;
    endDate?: string;
  }>;
}) {
  const { googleCalendar, startDate, endDate } = await searchParams;

  return (
    <main className="min-h-screen bg-warm-900 flex flex-col items-center px-4 py-8 md:py-12">
      <PlannerShell
        googleCalendarState={googleCalendar ?? null}
        googleCalendarStartDate={startDate ?? null}
        googleCalendarEndDate={endDate ?? null}
      />
    </main>
  );
}
