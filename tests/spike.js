// SPIKE: sudden surge (think: concert ends). Does the system survive and recover?
//   docker compose --profile tests run --rm k6 run /scripts/spike.js
import { login, seedDrivers, mixedTraffic } from './lib/common.js';

export const options = {
  stages: [
    { duration: '1m', target: 10 },    // warm-up
    { duration: '20s', target: 200 },  // spike
    { duration: '2m', target: 200 },   // hold
    { duration: '20s', target: 10 },   // drop
    { duration: '3m', target: 10 },    // recovery - latency should return to baseline
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<3000'],
  },
};

export function setup() {
  const token = login();
  seedDrivers(token, 60);
  return { token };
}

export default function ({ token }) {
  mixedTraffic(token, 'rider:1', 0.3);
}
