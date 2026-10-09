// SMOKE: 1 VU, 1 minute. "Does the whole system work at all?" Run after every deploy.
//   docker compose --profile tests run --rm k6 run /scripts/smoke.js
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, login, authHeaders, seedDrivers, fullRideFlow, stdThresholds } from './lib/common.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: { ...stdThresholds, ride_flow_success: ['rate==1'] },
};

export function setup() {
  const token = login();
  seedDrivers(token, 5);
  return { token };
}

export default function ({ token }) {
  const health = http.get(`${BASE_URL}/actuator/health`);
  check(health, { 'gateway healthy': (r) => r.status === 200 });

  const me = http.get(`${BASE_URL}/api/v1/auth/me`, authHeaders(token));
  check(me, { 'me 200': (r) => r.status === 200, 'email matches': (r) => r.json('email') === 'admin@example.com' });

  const noAuth = http.get(`${BASE_URL}/api/v1/rides/stats`);
  check(noAuth, { 'unauthenticated -> 401': (r) => r.status === 401 });

  fullRideFlow(token, 'rider:1');
}
