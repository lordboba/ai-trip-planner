import { LocalTripPage } from "@/components/local-trip-page";

export default async function LocalTripRoute({
  params,
}: {
  params: Promise<{ snapshotId: string }>;
}) {
  const { snapshotId } = await params;

  return <LocalTripPage snapshotId={snapshotId} />;
}
