import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { rideApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime, formatMoney, shortId } from "@/lib/utils";

export default function RidesPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-rides", user!.riderId],
    queryFn: () => rideApi.byRider(user!.riderId),
    refetchInterval: 5000,
  });

  const total = (data ?? []).filter((r) => r.status === "COMPLETED").reduce((s, r) => s + r.actualFare, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">My rides</h1>
        <p className="text-sm text-muted-foreground">Everything booked as {user!.riderId}.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-end justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>History</CardTitle>
            <CardDescription>Updates every 5 seconds.</CardDescription>
          </div>
          <p className="text-right text-sm text-muted-foreground">
            Completed total <span className="ml-1 font-display text-xl font-semibold tabular-nums text-foreground">{formatMoney(total)}</span>
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : isError ? (
            <p className="py-8 text-center text-sm text-destructive">Could not load rides.</p>
          ) : !data?.length ? (
            <div className="grid place-items-center gap-2 py-14 text-center text-muted-foreground">
              <Receipt className="size-8" />
              <p>No rides yet. Book your first one from the map.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ride</TableHead><TableHead>Route</TableHead><TableHead>Driver</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Fare</TableHead><TableHead>Requested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{shortId(r.id)}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate">{r.pickupAddress}</p>
                      <p className="truncate text-xs text-muted-foreground">→ {r.dropAddress}</p>
                    </TableCell>
                    <TableCell>{r.driverId ?? "–"}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.status === "COMPLETED" ? r.actualFare : r.estimatedFare)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
