import { useEffect, type ReactNode } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { config } from "@/lib/config";
import type { LatLng } from "@/lib/geo";

export function pinIcon(kind: "pickup" | "drop") {
  return L.divIcon({
    className: "",
    html: `<div class="pin ${kind}"><span></span><i></i></div>`,
    iconSize: [26, 26],
    iconAnchor: [4, 26],
  });
}

export function carIcon(state: "idle" | "assigned" | "selected" = "idle") {
  return L.divIcon({
    className: "",
    html: `<div class="car ${state === "idle" ? "" : state}">🚕</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function ClickHandler({ onClick }: { onClick?: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Fits the viewport to a set of points whenever the key changes. */
function Fit({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 16 });
    else if (points.length === 1) map.setView(points[0], Math.max(map.getZoom(), 14));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  return null;
}

/** The map's container size changes with the layout (panels, sidebar). Re-measure so tiles render. */
function Resizer() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

interface Props {
  className?: string;
  onClick?: (p: LatLng) => void;
  fitPoints?: [number, number][];
  fitKey?: string;
  route?: [number, number][] | null;
  children?: ReactNode;
}

export function MapView({ className, onClick, fitPoints = [], fitKey = "", route, children }: Props) {
  return (
    <MapContainer center={config.mapCenter} zoom={config.mapZoom} className={className} zoomControl={false} style={{ height: "100%", width: "100%" }}>
      <TileLayer url={config.tileUrl} attribution={config.tileAttribution} maxZoom={19} />
      <Resizer />
      <ClickHandler onClick={onClick} />
      <Fit points={fitPoints} fitKey={fitKey} />
      {route && route.length > 1 && (
        <>
          <Polyline positions={route} pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.9 }} />
          <Polyline positions={route} pathOptions={{ color: "#0f8b8d", weight: 5, opacity: 1 }} />
        </>
      )}
      {children}
    </MapContainer>
  );
}

export { Marker, Tooltip };
