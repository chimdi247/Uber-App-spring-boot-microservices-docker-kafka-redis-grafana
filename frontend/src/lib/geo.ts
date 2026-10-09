import axios from "axios";
import { config } from "./config";

export interface LatLng { lat: number; lng: number }
export interface Place extends LatLng { address: string }

export function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Same formula as ride-service (50 base + 12 per km) so the quote matches what the backend stores. */
export function estimateFare(a: LatLng, b: LatLng) {
  return Math.round((50 + haversineKm(a, b) * 12) * 100) / 100;
}

// ───────── Nominatim (OpenStreetMap geocoder) ─────────
const geocoder = axios.create({ baseURL: config.geocoderUrl, timeout: 10000 });

interface NominatimHit { lat: string; lon: string; display_name: string }

export async function searchPlaces(q: string, near?: LatLng): Promise<Place[]> {
  const params: Record<string, string | number> = { q, format: "jsonv2", limit: 5, "accept-language": "en" };
  if (near) {
    // bias (not restrict) results to ~50 km around the map centre
    const d = 0.5;
    params.viewbox = `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`;
  }
  const { data } = await geocoder.get<NominatimHit[]>("/search", { params });
  return data.map((h) => ({ lat: parseFloat(h.lat), lng: parseFloat(h.lon), address: h.display_name }));
}

export async function reverseGeocode(p: LatLng): Promise<string> {
  try {
    const { data } = await geocoder.get<{ display_name?: string }>("/reverse", {
      params: { lat: p.lat, lon: p.lng, format: "jsonv2", zoom: 18, "accept-language": "en" },
    });
    return data.display_name ?? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  } catch {
    return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
  }
}

// ───────── OSRM (Open Source Routing Machine) ─────────
export interface RouteResult { coords: [number, number][]; distanceKm: number; durationMin: number }

export async function fetchRoute(a: LatLng, b: LatLng, signal?: AbortSignal): Promise<RouteResult | null> {
  const url = `${config.osrmUrl}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}`;
  const { data } = await axios.get<{
    code: string;
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  }>(url, { params: { overview: "full", geometries: "geojson" }, signal, timeout: 15000 });
  const r = data.routes?.[0];
  if (data.code !== "Ok" || !r) return null;
  return {
    coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
  };
}
