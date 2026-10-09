// END-TO-END business flow under concurrency: request -> Kafka -> matching -> Redis geo -> accepted -> start -> complete.
// Exercises every service and the Kafka round-trip; checks time-to-match.
//   docker compose --profile tests run --rm k6 run /scripts/ride-flow.js
import { login, seedDrivers, fullRideFlow } from './lib/common.js';

export const options = {
  scenarios: {
    rides: {
      executor: 'constant-arrival-rate',
      rate: 5, timeUnit: '1s', duration: '3m',
      preAllocatedVUs: 30, maxVUs: 100,
    },
  },
  thresholds: {
    ride_flow_success: ['rate>0.95'],
    ride_match_time: ['p(95)<3000'],
    http_req_failed: ['rate<0.02'],
  },
};

export function setup() {
  const token = login();
  seedDrivers(token, 60);
  return { token };
}

export default function ({ token }) {
  fullRideFlow(token, `rider:${__VU}`);
}
