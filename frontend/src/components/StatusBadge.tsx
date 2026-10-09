import { Badge } from "@/components/ui/badge";
import type { RideStatus } from "@/lib/api";

const MAP: Record<RideStatus, { label: string; variant: "info" | "warning" | "success" | "danger" | "secondary" }> = {
  REQUESTED: { label: "Requested", variant: "info" },
  MATCHING: { label: "Finding driver", variant: "warning" },
  ACCEPTED: { label: "Driver assigned", variant: "info" },
  DRIVER_ARRIVING: { label: "Driver arriving", variant: "info" },
  RIDE_STARTED: { label: "On trip", variant: "success" },
  COMPLETED: { label: "Completed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "secondary" },
  NO_DRIVERS_AVAILABLE: { label: "No drivers", variant: "danger" },
};

export function StatusBadge({ status }: { status: RideStatus }) {
  const m = MAP[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
