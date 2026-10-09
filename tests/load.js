// LOAD: expected day-to-day traffic. Ramp to 20 VUs, hold 5 min, ramp down.
//   docker compose --profile tests run --rm k6 run /scripts/load.js
import { login, seedDrivers, mixedTraffic, stdThresholds } from './lib/common.js';

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '5m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  thresholds: stdThresholds,
};

export function setup() {
  const token = login();
  seedDrivers(token, 40);
  return { token };
}

export default function ({ token }) {
  mixedTraffic(token, 'rider:1', 0.2);
}
