import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Plus, Route as RouteIcon, Trash2, Users } from "lucide-react";
import type { Marker as LeafletMarker } from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapView, Marker, Tooltip, carIcon } from "@/components/map/MapView";
import { StatusBadge } from "@/components/StatusBadge";
import { errorMessage, locationApi, rideApi } from "@/lib/api";
import { config } from "@/lib/config";
import type { LatLng } from "@/lib/geo";
import { cn, formatMoney, shortId } from "@/lib/utils";

const [CLAT, CLNG] = config.mapCenter;

export default function DriversPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [newId, setNewId] = useState("driver:1");

  const drivers = useQuery({
    queryKey: ["fleet"],
    queryFn: () => locationApi.nearby(CLAT, CLNG, 100, 200),
    refetchInterval: 4000,
  });

  const trips = useQuery({
    queryKey: ["driver-rides", selected],
    queryFn: () => rideApi.byDriver(selected!),
    enabled: !!selected,
    refetchInterval: 3000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["fleet"] });
  const onErr = (e: unknown) => toast.error(errorMessage(e));

  const place = useMutation({
    mutationFn: ({ id, p }: { id: string; p: LatLng }) => locationApi.update(id, p.lat, p.lng),
    onSuccess: refresh, onError: onErr,
  });
  const remove = useMutation({
    mutationFn: (id: string) => locationApi.remove(id),
    onSuccess: (_d, id) => { if (selected === id) setSelected(null); refresh(); }, onError: onErr,
  });
  const seed = useMutation({
    mutationFn: () => Promise.all(Array.from({ length: 8 }, (_, i) =>
      locationApi.update(`driver:demo-${i + 1}`, CLAT + (Math.random() - 0.5) * 0.06, CLNG + (Math.random() - 0.5) * 0.06))),
    onSuccess: () => { toast.success("8 demo drivers online"); refresh(); }, onError: onErr,
  });
  const act = useMutation({
    mutationFn: ({ kind, id }: { kind: "start" | "complete"; id: string }) => rideApi[kind](id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver-rides"] }), onError: onErr,
  });

  const list = drivers.data ?? [];

  return (
    <div className="grid h-full min-h-[600px] lg:grid-cols-[380px_1fr]">
      <aside className="space-y-4 overflow-auto border-r bg-card p-5">
        <div>
          <h1 className="font-display text-2xl font-semibold">Driver console</h1>
          <p className="text-sm text-muted-foreground">Put drivers on the map. Click the map to place the driver ID below, drag a car to move it.</p>
        </div>

        <div className="flex gap-2">
          <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="driver:42" aria-label="Driver id" />
          <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending} title="Place 8 random drivers"><Users /> Seed</Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{list.length} driver{list.length === 1 ? "" : "s"} online</p>
          {list.length === 0 && <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Nobody online yet. Seed some drivers or click the map.</p>}
          <ul className="space-y-1.5">
            {list.map((d) => (
              <li key={d.driverId}>
                <button
                  onClick={() => setSelected(d.driverId === selected ? null : d.driverId)}
                  className={cn("flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted", selected === d.driverId && "border-ring bg-accent")}
                >
                  <span className="text-lg">🚕</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{d.driverId}</span>
                    <span className="block text-xs tabular-nums text-muted-foreground">{d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}</span>
                  </span>
                  <span
                    role="button" tabIndex={0} title="Go offline"
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); remove.mutate(d.driverId); }}
                    onKeyDown={(e) => { if (e.key === "Enter") remove.mutate(d.driverId); }}
                  ><Trash2 className="size-4" /></span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {selected && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Trips for {selected}</CardTitle>
              <CardDescription>Assigned by the matching service.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(trips.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No trips assigned yet.</p>}
              {(trips.data ?? []).slice(0, 6).map((r) => (
                <div key={r.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{shortId(r.id)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{r.pickupAddress} → {r.dropAddress}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-display tabular-nums">{formatMoney(r.estimatedFare)}</span>
                    {r.status === "ACCEPTED" && <Button size="sm" onClick={() => act.mutate({ kind: "start", id: r.id })}><RouteIcon /> Start</Button>}
                    {r.status === "RIDE_STARTED" && <Button size="sm" variant="meter" onClick={() => act.mutate({ kind: "complete", id: r.id })}><CheckCircle2 /> Complete</Button>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </aside>

      <div className="relative min-h-[420px]">
        <MapView onClick={(p) => place.mutate({ id: newId.trim() || "driver:1", p })}>
          {list.map((d) => (
            <Marker
              key={d.driverId}
              position={[d.latitude, d.longitude]}
              icon={carIcon(d.driverId === selected ? "selected" : "idle")}
              draggable
              eventHandlers={{
                click: () => setSelected(d.driverId),
                dragend: (e) => {
                  const ll = (e.target as LeafletMarker).getLatLng();
                  place.mutate({ id: d.driverId, p: { lat: ll.lat, lng: ll.lng } });
                },
              }}
            >
              <Tooltip>{d.driverId}</Tooltip>
            </Marker>
          ))}
        </MapView>
        <div className="pointer-events-none absolute left-4 top-4 z-[1100] rounded-md bg-card/95 px-3 py-2 text-xs shadow">
          <Plus className="mr-1 inline size-3" /> Click to place <b>{newId || "driver:1"}</b>
        </div>
      </div>
    </div>
  );
}
