// SOAK / ENDURANCE: moderate constant load for hours to expose leaks (memory, connections, Kafka lag).
// Default 2h, override with SOAK_DURATION=8h.
//   docker compose --profile tests run --rm -e SOAK_DURATION=30m k6 run /scripts/soak.js
import { login, seedDrivers, mixedTraffic, stdThresholds } from './lib/common.js';

export const options = {
  stages: [
    { duration: '5m', target: 15 },
    { duration: __ENV.SOAK_DURATION || '2h', target: 15 },
    { duration: '5m', target: 0 },
  ],
  thresholds: stdThresholds,
};

export function setup() {
  const token = login();
  seedDrivers(token, 40);
  return { token };
}

export default function ({ token }) {
  mixedTraffic(token, 'rider:1', 0.15);
}
