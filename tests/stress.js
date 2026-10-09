// STRESS: push beyond normal load in steps to see where latency / errors start to climb.
// Watch the Grafana CPU/memory panels and the 50% alerts while this runs.
//   docker compose --profile tests run --rm k6 run /scripts/stress.js
import { login, seedDrivers, mixedTraffic } from './lib/common.js';

export const options = {
  stages: [
    { duration: '2m', target: 25 },
    { duration: '3m', target: 25 },
    { duration: '2m', target: 60 },
    { duration: '3m', target: 60 },
    { duration: '2m', target: 120 },
    { duration: '3m', target: 120 },
    { duration: '3m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
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
