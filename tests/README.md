# Performance tests (k6)

All scripts talk to the **api-gateway** (`BASE_URL`, default `http://localhost:8080`), log in as
`admin@example.com` / `password123` and seed a pool of drivers around the map centre.

| Script | Type | Purpose | Duration |
|---|---|---|---|
| `smoke.js` | smoke | 1 VU, full ride lifecycle + auth checks. Run after every deploy | 30 s |
| `load.js` | load | 20 VUs of realistic mixed traffic | ~7 min |
| `stress.js` | stress | Steps 25 → 60 → 120 VUs to find where it degrades | ~18 min |
| `spike.js` | spike | Jump 10 → 200 VUs in 20 s, then verify recovery | ~7 min |
| `soak.js` | soak / endurance | 15 VUs for hours (leaks, Kafka lag, pool exhaustion) | 2 h (`SOAK_DURATION`) |
| `breakpoint.js` | capacity | Ramps requests/s until thresholds fail and aborts | ≤ 15 min |
| `ride-flow.js` | end-to-end | 5 complete rides/s: Kafka → matching → Redis → accepted → completed | 3 min |

## Run

Inside the compose network (nothing to install):

```bash
docker compose --profile tests run --rm k6 run /scripts/smoke.js
./tests/run.sh load          # same, but also streams metrics to Prometheus
./tests/run.sh soak -e SOAK_DURATION=30m
```

With a local k6 binary:

```bash
k6 run -e BASE_URL=http://localhost:8080 tests/load.js
```

## Watch it in Grafana

Open **RideShare – Services Overview** (http://localhost:3000) while a test runs: request rate, error rate,
latency percentiles, container CPU/memory and the business funnel move in real time. The stress/spike tests are
designed to cross the 50 % CPU / memory thresholds so you can see the Grafana alert e-mails arrive in Mailpit
(http://localhost:8025).

Use the same environment variables as the scripts (`TEST_EMAIL`, `TEST_PASSWORD`, `CENTER_LAT`, `CENTER_LNG`) to
point the tests at another user or city.
