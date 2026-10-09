import axios, { AxiosError } from "axios";

const TOKEN_KEY = "rideshare.token";
export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({ baseURL: "/api/v1", timeout: 20000 });

api.interceptors.request.use((req) => {
  const t = tokenStore.get();
  if (t) req.headers.Authorization = `Bearer ${t}`;
  return req;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    // expired / invalid token: drop it and let the auth context send the user to /login
    if (err.response?.status === 401 && !err.config?.url?.includes("/auth/login")) {
      tokenStore.clear();
      window.dispatchEvent(new Event("rideshare:unauthorized"));
    }
    return Promise.reject(err);
  },
);

export function errorMessage(e: unknown): string {
  const err = e as AxiosError<{ error?: string } & Record<string, string>>;
  if (err.response?.data) {
    const d = err.response.data;
    if (typeof d === "string") return d;
    if (d.error && Object.keys(d).length === 1) return d.error;
    const fields = Object.entries(d).filter(([k]) => k !== "error").map(([, v]) => v);
    if (fields.length) return fields.join(", ");
    if (d.error) return d.error;
  }
  if (err.code === "ECONNABORTED") return "The request timed out";
  if (err.message) return err.message;
  return "Something went wrong";
}

// ───────── types ─────────
export interface User { id: number; riderId: string; email: string; fullName: string; role: string }
export interface AuthResponse { token: string; tokenType: string; expiresIn: number; user: User }

export type RideStatus =
  | "REQUESTED" | "MATCHING" | "ACCEPTED" | "DRIVER_ARRIVING"
  | "RIDE_STARTED" | "COMPLETED" | "CANCELLED" | "NO_DRIVERS_AVAILABLE";

export interface Ride {
  id: string; riderId: string; driverId?: string | null;
  pickupLatitude: number; pickupLongitude: number; pickupAddress: string;
  dropLatitude: number; dropLongitude: number; dropAddress: string;
  status: RideStatus; estimatedFare: number; actualFare: number;
  createdAt?: string; updatedAt?: string; startedAt?: string | null; completedAt?: string | null;
}
export interface RideRequestBody {
  riderId: string;
  pickupLatitude: number; pickupLongitude: number; pickupAddress: string;
  dropLatitude: number; dropLongitude: number; dropAddress: string;
}
export interface RideStats {
  totalRides: number; activeRides: number; completedRides: number; cancelledRides: number;
  unmatchedRides: number; totalRevenue: number; byStatus: Record<string, number>;
}
export interface NearbyDriver { driverId: string; latitude: number; longitude: number; distanceInKm: number }

export const TERMINAL: RideStatus[] = ["COMPLETED", "CANCELLED", "NO_DRIVERS_AVAILABLE"];

// ───────── calls ─────────
export const authApi = {
  login: (email: string, password: string) => api.post<AuthResponse>("/auth/login", { email, password }).then((r) => r.data),
  register: (fullName: string, email: string, password: string) =>
    api.post<AuthResponse>("/auth/register", { fullName, email, password }).then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
};

export const rideApi = {
  request: (b: RideRequestBody) => api.post<Ride>("/rides/request", b).then((r) => r.data),
  get: (id: string) => api.get<Ride>(`/rides/${id}`).then((r) => r.data),
  byRider: (riderId: string) => api.get<Ride[]>(`/rides/rider/${encodeURIComponent(riderId)}`).then((r) => r.data),
  byDriver: (driverId: string) => api.get<Ride[]>(`/rides/driver/${encodeURIComponent(driverId)}`).then((r) => r.data),
  list: (limit = 50) => api.get<Ride[]>("/rides", { params: { limit } }).then((r) => r.data),
  stats: () => api.get<RideStats>("/rides/stats").then((r) => r.data),
  start: (id: string) => api.put<Ride>(`/rides/${id}/start`).then((r) => r.data),
  complete: (id: string) => api.put<Ride>(`/rides/${id}/complete`).then((r) => r.data),
  cancel: (id: string) => api.put<Ride>(`/rides/${id}/cancel`).then((r) => r.data),
};

export const locationApi = {
  nearby: (latitude: number, longitude: number, radius = 5, limit = 50) =>
    api.get<NearbyDriver[]>("/locations/drivers/nearby", { params: { latitude, longitude, radius, limit } }).then((r) => r.data),
  update: (driverId: string, latitude: number, longitude: number) =>
    api.post("/locations/drivers/update", { driverId, latitude, longitude }).then((r) => r.data),
  remove: (driverId: string) => api.delete(`/locations/drivers/${encodeURIComponent(driverId)}`).then((r) => r.data),
};
