export interface AppConfig {
  mapCenter: [number, number];
  mapZoom: number;
  tileUrl: string;
  tileAttribution: string;
  geocoderUrl: string;
  osrmUrl: string;
  tools: { grafana: string; kafkaUi: string; redisUi: string; mailpit: string; prometheus: string };
}

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<AppConfig>;
  }
}

const defaults: AppConfig = {
  mapCenter: [12.9716, 77.5946],
  mapZoom: 13,
  tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution: "&copy; OpenStreetMap contributors",
  geocoderUrl: "https://nominatim.openstreetmap.org",
  osrmUrl: "/osrm",
  tools: {
    grafana: "http://localhost:3000",
    kafkaUi: "http://localhost:8085",
    redisUi: "http://localhost:8087",
    mailpit: "http://localhost:8025",
    prometheus: "http://localhost:9090",
  },
};

const injected = window.__APP_CONFIG__ ?? {};
export const config: AppConfig = {
  ...defaults,
  ...injected,
  mapCenter: (injected.mapCenter ?? defaults.mapCenter).map(Number) as [number, number],
  mapZoom: Number(injected.mapZoom ?? defaults.mapZoom),
  tools: { ...defaults.tools, ...(injected.tools ?? {}) },
};
