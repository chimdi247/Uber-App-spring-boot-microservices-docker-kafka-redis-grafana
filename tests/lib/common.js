// Shared helpers for all k6 scripts.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';   // api-gateway
export const EMAIL = __ENV.TEST_EMAIL || 'admin@example.com';
export const PASSWORD = __ENV.TEST_PASSWORD || 'password123';
const CENTER = {
  lat: parseFloat(__ENV.CENTER_LAT || '12.9716'),
  lng: parseFloat(__ENV.CENTER_LNG || '77.5946'),
};

// Business metrics (also visible in Prometheus when run with the k6 service: `-o experimental-prometheus-rw`)
export const rideMatchTime = new Trend('ride_match_time', true);
export const ridesCompleted = new Counter('rides_completed');
export const rideFlowSuccess = new Rate('ride_flow_success');

export function login() {
  const res = http.post(`${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'POST /auth/login' } });
  check(res, { 'login 200': (r) => r.status === 200 });
  return res.json('token');
}

export function authHeaders(token) {
  return { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };
}

export function jitter(range = 0.04) {
  return (Math.random() - 0.5) * 2 * range;
}

export function point() {
  return { lat: CENTER.lat + jitter(), lng: CENTER.lng + jitter() };
}

export function seedDrivers(token, count = 25) {
  for (let i = 1; i <= count; i++) {
    const p = point();
    http.post(`${BASE_URL}/api/v1/locations/drivers/update`,
      JSON.stringify({ driverId: `driver:load-${i}`, latitude: p.lat, longitude: p.lng }),
      { ...authHeaders(token), tags: { name: 'POST /locations/drivers/update' } });
  }
}

export function requestRide(token, riderId) {
  const a = point(); const b = point();
  return http.post(`${BASE_URL}/api/v1/rides/request`, JSON.stringify({
    riderId,
    pickupLatitude: a.lat, pickupLongitude: a.lng, pickupAddress: 'k6 pickup',
    dropLatitude: b.lat, dropLongitude: b.lng, dropAddress: 'k6 drop',
  }), { ...authHeaders(token), tags: { name: 'POST /rides/request' } });
}

// Polls until the ride leaves MATCHING (max ~10 s). Returns the last ride payload.
export function waitForMatch(token, rideId) {
  const t0 = Date.now();
  let ride = null;
  for (let i = 0; i < 20; i++) {
    const r = http.get(`${BASE_URL}/api/v1/rides/${rideId}`, { ...authHeaders(token), tags: { name: 'GET /rides/{id}' } });
    if (r.status === 200) {
      ride = r.json();
      if (ride.status !== 'MATCHING' && ride.status !== 'REQUESTED') break;
    }
    sleep(0.5);
  }
  rideMatchTime.add(Date.now() - t0);
  return ride;
}

// Full lifecycle: request -> matched -> start -> complete
export function fullRideFlow(token, riderId) {
  const created = requestRide(token, riderId);
  if (!check(created, { 'ride created 201': (r) => r.status === 201 })) { rideFlowSuccess.add(false); return; }
  const id = created.json('id');
  const ride = waitForMatch(token, id);
  const matched = ride && ride.status === 'ACCEPTED';
  check(ride, { 'ride matched': () => matched });
  if (!matched) { rideFlowSuccess.add(false); return; }
  const s = http.put(`${BASE_URL}/api/v1/rides/${id}/start`, null, { ...authHeaders(token), tags: { name: 'PUT /rides/{id}/start' } });
  const c = http.put(`${BASE_URL}/api/v1/rides/${id}/complete`, null, { ...authHeaders(token), tags: { name: 'PUT /rides/{id}/complete' } });
  const ok = check(c, { 'ride started': () => s.status === 200, 'ride completed': (r) => r.status === 200 });
  rideFlowSuccess.add(ok);
  if (ok) ridesCompleted.add(1);
}

// One iteration of "typical browsing + occasional booking" traffic
export function mixedTraffic(token, riderId, bookingRatio = 0.2) {
  const p = point();
  const r1 = http.get(`${BASE_URL}/api/v1/locations/drivers/nearby?latitude=${p.lat}&longitude=${p.lng}&radius=5`,
    { ...authHeaders(token), tags: { name: 'GET /locations/drivers/nearby' } });
  const r2 = http.get(`${BASE_URL}/api/v1/rides/rider/${riderId}`, { ...authHeaders(token), tags: { name: 'GET /rides/rider/{id}' } });
  const r3 = http.get(`${BASE_URL}/api/v1/rides/stats`, { ...authHeaders(token), tags: { name: 'GET /rides/stats' } });
  check(r1, { 'nearby 200': (r) => r.status === 200 });
  check(r2, { 'history 200': (r) => r.status === 200 });
  check(r3, { 'stats 200': (r) => r.status === 200 });
  if (Math.random() < bookingRatio) {
    const created = requestRide(token, riderId);
    check(created, { 'ride created 201': (r) => r.status === 201 });
  }
  sleep(Math.random() * 1.5 + 0.5);
}

export const stdThresholds = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<800', 'p(99)<1500'],
  checks: ['rate>0.99'],
};
