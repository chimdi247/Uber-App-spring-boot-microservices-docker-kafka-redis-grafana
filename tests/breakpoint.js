// BREAKPOINT (capacity): keep raising the arrival rate until thresholds fail; the test aborts at that point
// and the last rate is your capacity limit. Run it against a non-production stack only.
//   docker compose --profile tests run --rm k6 run /scripts/breakpoint.js
import { login, seedDrivers, mixedTraffic } from './lib/common.js';

export const options = {
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 2000,
      stages: [{ duration: '15m', target: 600 }],
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: [{ threshold: 'p(95)<2000', abortOnFail: true, delayAbortEval: '30s' }],
  },
};

export function setup() {
  const token = login();
  seedDrivers(token, 80);
  return { token };
}

export default function ({ token }) {
  mixedTraffic(token, 'rider:1', 0.1);
}
