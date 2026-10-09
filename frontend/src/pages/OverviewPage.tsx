import { useQuery } from "@tanstack/react-query";
import { Ban, CarFront, CircleCheck, Coins, Hourglass, SearchX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { rideApi } from "@/lib/api";
import { formatDateTime, formatMoney, shortId } from "@/lib/utils";

const BAR_COLORS: Record<string, string> = {
  COMPLETED: "bg-route", RIDE_STARTED: "bg-route/60", ACCEPTED: "bg-primary/70", DRIVER_ARRIVING: "bg-primary/60",
  MATCHING: "bg-meter", REQUESTED: "bg-meter/70", CANCELLED: "bg-muted-foreground/50", NO_DRIVERS_AVAILABLE: "bg-destructive",
};

export default function OverviewPage() {
  const stats = useQuery({ queryKey: ["stats"], queryFn: rideApi.stats, refetchInterval: 5000 });
  const recent = useQuery({ queryKey: ["recent"], queryFn: () => rideApi.list(15), refetchInterval: 5000 });
  const s = stats.data;
  const matchBase = s ? s.totalRides - s.activeRides : 0;
  const completionRate = s && s.totalRides - s.activeRides > 0 ? Math.round((s.completedRides / matchBase) * 100) : 0;

  const cards = [
    { label: "Total rides", value: s?.totalRides, icon: CarFront },
    { label: "In progress", value: s?.activeRides, icon: Hourglass },
    { label: "Completed", value: s?.completedRides, icon: CircleCheck },
    { label: "Cancelled", value: s?.cancelledRides, icon: Ban },
    { label: "No driver found", value: s?.unmatchedRides, icon: SearchX },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Operations</h1>
        <p className="text-sm text-muted-foreground">Business KPIs straight from the ride database. Infrastructure and SLOs live in Grafana.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card className="bg-ink text-primary-foreground sm:col-span-2 lg:col-span-1">
          <CardContent className="flex h-full flex-col justify-between p-5">
            <Coins className="size-5 text-meter" />
            <div className="mt-6">
              <p className="text-xs text-primary-foreground/60">Revenue</p>
              {stats.isLoading ? <Skeleton className="mt-1 h-9 w-24 bg-white/10" /> :
                <p className="font-display text-3xl font-semibold tabular-nums text-meter">{formatMoney(s?.totalRevenue)}</p>}
            </div>
          </CardContent>
        </Card>
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <Icon className="size-5 text-muted-foreground" />
              <p className="mt-6 text-xs text-muted-foreground">{label}</p>
              {stats.isLoading ? <Skeleton className="mt-1 h-9 w-14" /> : <p className="font-display text-3xl font-semibold tabular-nums">{value ?? 0}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ride status mix</CardTitle>
          <CardDescription>Completion rate of finished rides: <b className="text-foreground">{completionRate}%</b></CardDescription>
        </CardHeader>
        <CardContent>
          {s && s.totalRides > 0 ? (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                {Object.entries(s.byStatus).filter(([, n]) => n > 0).map(([k, n]) => (
                  <div key={k} className={BAR_COLORS[k] ?? "bg-primary"} style={{ width: `${(n / s.totalRides) * 100}%` }} title={`${k}: ${n}`} />
                ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                {Object.entries(s.byStatus).filter(([, n]) => n > 0).map(([k, n]) => (
                  <li key={k} className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${BAR_COLORS[k] ?? "bg-primary"}`} />{k.replaceAll("_", " ").toLowerCase()} · {n}</li>
                ))}
              </ul>
            </>
          ) : <p className="text-sm text-muted-foreground">No rides yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Latest rides</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ride</TableHead><TableHead>Rider</TableHead><TableHead>Driver</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Fare</TableHead><TableHead>Requested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recent.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{shortId(r.id)}</TableCell>
                  <TableCell>{r.riderId}</TableCell>
                  <TableCell>{r.driverId ?? "–"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.status === "COMPLETED" ? r.actualFare : r.estimatedFare)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                </TableRow>
              ))}
              {!recent.isLoading && !recent.data?.length && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Nothing here yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
