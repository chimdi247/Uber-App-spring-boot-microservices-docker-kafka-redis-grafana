import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, MapPin, Navigation, Plus, Route as RouteIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MapView, Marker, Tooltip, carIcon, pinIcon } from "@/components/map/MapView";
import { PlaceSearch } from "@/components/PlaceSearch";
import { StatusBadge } from "@/components/StatusBadge";
import { errorMessage, locationApi, rideApi, TERMINAL, type Ride } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import { estimateFare, fetchRoute, reverseGeocode, type LatLng, type Place, type RouteResult } from "@/lib/geo";
import { cn, formatMoney, shortId } from "@/lib/utils";

const ACTIVE_KEY = "rideshare.activeRide";

const STEPS = [
  { key: "match", label: "Finding a driver" },
  { key: "assigned", label: "Driver assigned" },
  { key: "trip", label: "On trip" },
  { key: "done", label: "Arrived" },
];
function stepIndex(s: Ride["status"]) {
  switch (s) {
    case "REQUESTED": case "MATCHING": return 0;
    case "ACCEPTED": case "DRIVER_ARRIVING": return 1;
    case "RIDE_STARTED": return 2;
    case "COMPLETED": return 3;
    default: return -1;
  }
}

/** Taxi-meter style fare read-out: the one deliberately loud element of the screen. */
function FareMeter({ fare, label, distanceKm, durationMin }: { fare: number; label: string; distanceKm?: number; durationMin?: number }) {
  return (
    <div className="rounded-lg bg-ink px-4 py-3 text-primary-foreground">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-primary-foreground/60">{label}</p>
          <p className="font-display text-4xl font-semibold tabular-nums leading-tight text-meter">{formatMoney(fare)}</p>
        </div>
        {distanceKm !== undefined && (
          <div className="pb-1 text-right text-xs tabular-nums text-primary-foreground/75">
            <p>{distanceKm.toFixed(1)} km</p>
            {durationMin !== undefined && <p>{Math.max(1, Math.round(durationMin))} min drive</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookRidePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const riderId = user!.riderId;

  const [pickup, setPickup] = useState<Place | null>(null);
  const [drop, setDrop] = useState<Place | null>(null);
  const [pickupText, setPickupText] = useState("");
  const [dropText, setDropText] = useState("");
  const [active, setActive] = useState<"pickup" | "drop">("pickup");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [rideId, setRideId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY));

  // ───── ride being tracked ─────
  const rideQuery = useQuery({
    queryKey: ["ride", rideId],
    queryFn: () => rideApi.get(rideId!),
    enabled: !!rideId,
    refetchInterval: (q) => (q.state.data && TERMINAL.includes(q.state.data.status) ? false : 2000),
    retry: 3,
  });
  const ride = rideQuery.data;
  const tracking = !!ride;

  useEffect(() => {
    if (rideQuery.isError && rideId) {
      // ride vanished (e.g. database was reset): forget it
      localStorage.removeItem(ACTIVE_KEY);
      setRideId(null);
    }
  }, [rideQuery.isError, rideId]);

  // effective points: when tracking they come from the ride itself
  const from: LatLng | null = tracking ? { lat: ride!.pickupLatitude, lng: ride!.pickupLongitude } : pickup;
  const to: LatLng | null = tracking ? { lat: ride!.dropLatitude, lng: ride!.dropLongitude } : drop;

  // ───── route via OSRM ─────
  const routeKey = from && to ? `${from.lat},${from.lng}>${to.lat},${to.lng}` : "";
  useEffect(() => {
    if (!from || !to) { setRoute(null); return; }
    const ctrl = new AbortController();
    setRouteLoading(true);
    fetchRoute(from, to, ctrl.signal)
      .then((r) => setRoute(r))
      .catch((e) => { if (!ctrl.signal.aborted) { setRoute(null); console.warn("routing failed", e); } })
      .finally(() => { if (!ctrl.signal.aborted) setRouteLoading(false); });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  // ───── nearby drivers (refreshed every 5 s) ─────
  const around = from;
  const nearby = useQuery({
    queryKey: ["nearby", around?.lat, around?.lng],
    queryFn: () => locationApi.nearby(around!.lat, around!.lng, 5, 30),
    enabled: !!around,
    refetchInterval: 5000,
  });

  // ───── map interaction ─────
  const reqId = useRef({ pickup: 0, drop: 0 });
  const onMapClick = useCallback(async (p: LatLng) => {
    if (tracking) return;
    const target = active;
    const id = ++reqId.current[target];
    const provisional = `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
    const setter = target === "pickup" ? setPickup : setDrop;
    const textSetter = target === "pickup" ? setPickupText : setDropText;
    setter({ ...p, address: provisional });
    textSetter(provisional);
    if (target === "pickup") setActive("drop");
    const address = await reverseGeocode(p);
    if (id === reqId.current[target]) {   // ignore stale reverse-geocode answers
      setter({ ...p, address });
      textSetter(address);
    }
  }, [active, tracking]);

  // ───── mutations ─────
  const requestMut = useMutation({
    mutationFn: () => rideApi.request({
      riderId,
      pickupLatitude: pickup!.lat, pickupLongitude: pickup!.lng, pickupAddress: pickup!.address,
      dropLatitude: drop!.lat, dropLongitude: drop!.lng, dropAddress: drop!.address,
    }),
    onSuccess: (r) => {
      localStorage.setItem(ACTIVE_KEY, r.id);
      qc.setQueryData(["ride", r.id], r);
      setRideId(r.id);
      qc.invalidateQueries({ queryKey: ["my-rides"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const transition = useMutation({
    mutationFn: ({ kind, id }: { kind: "start" | "complete" | "cancel"; id: string }) => rideApi[kind](id),
    onSuccess: (r) => {
      qc.setQueryData(["ride", r.id], r);
      qc.invalidateQueries({ queryKey: ["my-rides"] });
      if (r.status === "COMPLETED") toast.success(`Ride completed · fare ${formatMoney(r.actualFare)}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const seedDrivers = useMutation({
    mutationFn: async () => {
      const c = from ?? { lat: config.mapCenter[0], lng: config.mapCenter[1] };
      await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          locationApi.update(`driver:demo-${i + 1}`, c.lat + (Math.random() - 0.5) * 0.04, c.lng + (Math.random() - 0.5) * 0.04)),
      );
    },
    onSuccess: () => { toast.success("6 demo drivers placed nearby"); nearby.refetch(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function reset() {
    localStorage.removeItem(ACTIVE_KEY);
    setRideId(null);
    setPickup(null); setDrop(null); setPickupText(""); setDropText(""); setActive("pickup"); setRoute(null);
  }

  const fare = useMemo(() => (pickup && drop ? estimateFare(pickup, drop) : 0), [pickup, drop]);
  const driversNearby = nearby.data ?? [];
  const assignedDriver = ride?.driverId ? driversNearby.find((d) => d.driverId === ride.driverId) : undefined;
  const fitPoints = [from, to].filter(Boolean).map((p) => [p!.lat, p!.lng] as [number, number]);
  const canRequest = !!pickup && !!drop && !requestMut.isPending;
  const step = ride ? stepIndex(ride.status) : -1;

  return (
    <div className="relative h-full min-h-[560px]">
      <MapView
        onClick={onMapClick}
        fitPoints={fitPoints}
        fitKey={routeKey}
        route={route?.coords ?? (from && to ? [[from.lat, from.lng], [to.lat, to.lng]] : null)}
      >
        {from && <Marker position={[from.lat, from.lng]} icon={pinIcon("pickup")}><Tooltip>Pickup</Tooltip></Marker>}
        {to && <Marker position={[to.lat, to.lng]} icon={pinIcon("drop")}><Tooltip>Drop-off</Tooltip></Marker>}
        {driversNearby.map((d) => (
          <Marker key={d.driverId} position={[d.latitude, d.longitude]} icon={carIcon(d.driverId === ride?.driverId ? "assigned" : "idle")}>
            <Tooltip>{d.driverId} · {d.distanceInKm.toFixed(2)} km</Tooltip>
          </Marker>
        ))}
      </MapView>

      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[1100] md:inset-y-4 md:left-4 md:right-auto md:w-[410px]">
        <Card className="pointer-events-auto max-h-[70vh] overflow-auto border-0 p-5 shadow-xl md:max-h-full">
          {!tracking ? (
            <>
              <h1 className="font-display text-2xl font-semibold">Where to?</h1>
              <p className="mb-4 text-sm text-muted-foreground">Search an address, or click the map to drop a pin.</p>

              <div className="space-y-2">
                <PlaceSearch
                  dot="pickup" placeholder="Pickup location" value={pickupText} active={active === "pickup"}
                  onFocus={() => setActive("pickup")} onTextChange={setPickupText}
                  onSelect={(p) => { setPickup(p); setPickupText(p.address); setActive("drop"); }}
                />
                <PlaceSearch
                  dot="drop" placeholder="Drop-off location" value={dropText} active={active === "drop"}
                  onFocus={() => setActive("drop")} onTextChange={setDropText}
                  onSelect={(p) => { setDrop(p); setDropText(p.address); }}
                />
              </div>

              {pickup && drop && (
                <div className="mt-4 space-y-3">
                  <FareMeter
                    label="Estimated fare" fare={fare}
                    distanceKm={route?.distanceKm} durationMin={route?.durationMin}
                  />
                  {routeLoading && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Calculating route…</p>}
                  {!routeLoading && !route && <p className="text-xs text-muted-foreground">Routing engine unavailable - showing a straight line.</p>}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="grid size-5 place-items-center rounded-full bg-meter text-[11px]">🚕</span>
                  {pickup ? `${driversNearby.length} driver${driversNearby.length === 1 ? "" : "s"} within 5 km` : "Set a pickup to see drivers"}
                </span>
                {pickup && driversNearby.length === 0 && !nearby.isLoading && (
                  <Button variant="outline" size="sm" onClick={() => seedDrivers.mutate()} disabled={seedDrivers.isPending}>
                    <Plus /> Add demo drivers
                  </Button>
                )}
              </div>

              <Button variant="meter" size="lg" className="mt-4 w-full" disabled={!canRequest} onClick={() => requestMut.mutate()}>
                {requestMut.isPending ? <Loader2 className="animate-spin" /> : <Navigation />} Request ride
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-2xl font-semibold">
                    {ride!.status === "COMPLETED" ? "You've arrived" :
                      ride!.status === "CANCELLED" ? "Ride cancelled" :
                      ride!.status === "NO_DRIVERS_AVAILABLE" ? "No drivers nearby" : "Your ride"}
                  </h1>
                  <p className="text-xs text-muted-foreground">#{shortId(ride!.id)}</p>
                </div>
                <StatusBadge status={ride!.status} />
              </div>

              {step >= 0 && (
                <ol className="mt-4 grid grid-cols-4 gap-1.5">
                  {STEPS.map((s, i) => (
                    <li key={s.key} className="space-y-1.5">
                      <div className={cn("h-1.5 rounded-full bg-muted transition-colors", i <= step && "bg-route", i === step && ride!.status !== "COMPLETED" && "animate-pulse")} />
                      <p className={cn("text-[11px] leading-tight text-muted-foreground", i <= step && "font-medium text-foreground")}>{s.label}</p>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-4 space-y-2.5 text-sm">
                <div className="flex gap-3"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-route" /><p className="line-clamp-2">{ride!.pickupAddress}</p></div>
                <div className="flex gap-3"><span className="mt-1.5 size-2.5 shrink-0 rounded-[2px] bg-ink" /><p className="line-clamp-2">{ride!.dropAddress}</p></div>
              </div>

              <div className="mt-4">
                <FareMeter
                  label={ride!.status === "COMPLETED" ? "Fare charged" : "Estimated fare"}
                  fare={ride!.status === "COMPLETED" ? ride!.actualFare : ride!.estimatedFare}
                  distanceKm={route?.distanceKm} durationMin={route?.durationMin}
                />
              </div>

              {ride!.driverId && (
                <>
                  <Separator className="my-4" />
                  <div className="flex items-center gap-3">
                    <div className="grid size-11 place-items-center rounded-full bg-meter text-xl">🚕</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{ride!.driverId}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignedDriver ? `${assignedDriver.distanceInKm.toFixed(2)} km from pickup` : "Assigned by the matching service"}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {(ride!.status === "MATCHING" || ride!.status === "REQUESTED") && (
                <p className="mt-4 flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
                  <Loader2 className="size-4 animate-spin" /> Matching via Kafka → matching-service → Redis geo…
                </p>
              )}

              {ride!.status === "NO_DRIVERS_AVAILABLE" && (
                <div className="mt-4 space-y-2">
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">No driver within 5 km of the pickup point.</p>
                  <Button variant="outline" className="w-full" onClick={() => seedDrivers.mutate()} disabled={seedDrivers.isPending}>
                    <Plus /> Add demo drivers near pickup
                  </Button>
                </div>
              )}

              {/* There is no separate driver app in this demo, so the trip can be driven from here */}
              {(ride!.status === "ACCEPTED" || ride!.status === "DRIVER_ARRIVING" || ride!.status === "RIDE_STARTED") && (
                <div className="mt-4 rounded-md border border-dashed p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Demo controls (normally done in the driver app)</p>
                  {ride!.status !== "RIDE_STARTED" ? (
                    <Button className="w-full" onClick={() => transition.mutate({ kind: "start", id: ride!.id })} disabled={transition.isPending}>
                      <RouteIcon /> Start trip
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={() => transition.mutate({ kind: "complete", id: ride!.id })} disabled={transition.isPending}>
                      <CheckCircle2 /> Complete trip
                    </Button>
                  )}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                {!TERMINAL.includes(ride!.status) && ride!.status !== "RIDE_STARTED" && (
                  <Button variant="outline" className="flex-1" onClick={() => transition.mutate({ kind: "cancel", id: ride!.id })} disabled={transition.isPending}>
                    <X /> Cancel ride
                  </Button>
                )}
                {TERMINAL.includes(ride!.status) && (
                  <Button variant="meter" className="flex-1" onClick={reset}><MapPin /> Book another ride</Button>
                )}
              </div>
              {ride!.status === "COMPLETED" && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="size-3" /> Trace this ride in Grafana → Observability.</p>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
