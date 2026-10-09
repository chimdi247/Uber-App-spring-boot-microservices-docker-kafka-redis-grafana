# RideShare - Uber-style microservices platform

React + shadcn/ui frontend, Spring Boot microservices, Kafka, Redis geo-search, MySQL behind ProxySQL, and a full
OpenTelemetry → Prometheus / Loki / Tempo → Grafana observability stack - all started by **one** compose file.

Original walkthrough: [How Uber Works Under The Hood](https://www.youtube.com/watch?v=Cdx4DF9N8d8)

## Quick start

```bash
docker compose up -d --build        # first build downloads dependencies: allow 10-15 minutes
```

Wait until `docker compose ps` shows everything `healthy` (about 2 minutes after the build), then open:

| What | URL | Login |
|---|---|---|
| **Web app** | http://localhost:8088 | `admin@example.com` / `password123` |
| **Grafana** | http://localhost:3000 | `admin` / `admin` |
| Kafka UI | http://localhost:8085 | - |
| Redis UI | http://localhost:8087 | - |
| Mailpit (alert e-mails) | http://localhost:8025 | - |
| Prometheus | http://localhost:9090 | - |
| API gateway | http://localhost:8080 | JWT from `/api/v1/auth/login` |
| ProxySQL (MySQL protocol) | `localhost:6033` (user `uber_app` / `uber_app_pw`, db `uberapp`) | admin iface `6032` (`admin`/`admin`) |
| MySQL primary / replica (direct) | `localhost:3307` / `localhost:3308` | root / `MYSQL_ROOT_PASSWORD` in `.env` |

Try it: sign in → **Book a ride** → search an address or click the map → if no drivers are nearby press
**Add demo drivers** → *Request ride* → watch it match → use the *Demo controls* to start/complete the trip.

Stop: `docker compose down` (add `-v` to wipe all data, which also re-runs the SQL init scripts).

## Architecture

```
Browser ──► nginx (frontend:8088) ──► api-gateway:8080 ──┬─► auth-service:8081      ─► MySQL (via ProxySQL)
              │  /osrm  ─► OSRM routing                  ├─► ride-service:8083      ─► MySQL (via ProxySQL), Kafka
              │                                          └─► location-service:8082  ─► Redis (GEO)
              └ map tiles / address search: OpenStreetMap / Nominatim (browser)

ride-service ──ride.requested──► Kafka ──► matching-service ──REST (Feign)──► location-service
ride-service ◄──ride.matched───  Kafka ◄── matching-service
```

| Service | Port | Responsibility |
|---|---|---|
| `frontend` | 8088 | React 18 + Vite + Tailwind + shadcn/ui, Leaflet map, served by nginx (also proxies `/api` and `/osrm`) |
| `api-gateway` | 8080 | Spring Cloud Gateway: routing + JWT validation (**new**) |
| `auth-service` | 8081 | Users, BCrypt passwords, JWT issue (**new**) |
| `location-service` | 8082 | Driver positions in Redis GEO |
| `ride-service` | 8083 | Ride lifecycle, Kafka producer/consumer |
| `matching-service` | 8084 | Consumes `ride.requested`, picks a driver, publishes `ride.matched` |

### Database (`docker/mysql`)
* `init/00-database-and-users.sql` - database + least-privilege users (app, replication, monitor, exporter)
* `init/01-schema.sql` - tables `users` and `rides` (Hibernate runs with `ddl-auto: none`)
* `init/02-seed-admin-user.sql` - `admin@example.com` / `password123`; only the **BCrypt hash** is stored
* The scripts run automatically the first time the primary starts. A one-shot job (`mysql-replication-setup`) then
  attaches a GTID replica.
* **ProxySQL** (`docker/proxysql/proxysql.cnf`) pools and multiplexes connections, and load-balances: writes and all
  normal reads go to the primary; read-only queries that the app tags (`/* route:reader */`, see `RideRepository`)
  go to the replica. If the replica is down they fall back to the primary.

### Routing and maps
Map tiles come from OpenStreetMap (change `MAP_TILE_URL` in `.env`), address search from Nominatim, routing from
**OSRM** through the frontend's `/osrm/` path. The default upstream is the public OSRM demo server (fine for
development, no SLA). To self-host OSRM:

```bash
# .env
OSRM_UPSTREAM=http://osrm:5000
OSRM_HOST_HEADER=osrm
OSRM_PBF_URL=https://download.geofabrik.de/<your-region>-latest.osm.pbf   # must cover MAP_CENTER_*
docker compose --profile osrm up -d        # downloads + preprocesses the extract once, then serves it
docker compose up -d frontend              # pick up the new upstream
```

## Observability (`observability/`)

```
Spring services + OTel Java agent ──OTLP──► otel-collector ──► Tempo   (traces)
  (HTTP, JDBC, Kafka, Redis, Feign,                          ├► Prometheus (metrics, scraped from the collector)
   logs, JVM, custom business metrics)                       └► Loki    (logs, with trace_id / span_id)
cAdvisor, node-exporter, mysqld-exporters, ProxySQL (built-in), kafka-exporter, redis-exporter, blackbox ──► Prometheus
Grafana: Prometheus + Loki + Tempo datasources, dashboards, alert rules, SMTP
```

* **Auto-instrumentation** - the `opentelemetry-javaagent` is baked into every Java image and configured only through
  `OTEL_*` variables in `docker-compose.yml`. W3C `traceparent` is propagated across HTTP (gateway → services, Feign) and
  **Kafka** (producer → consumer), so one ride is a single trace across all services.
* **API/SDK** - each service depends on `opentelemetry-api` and records business KPIs (`rides_*`, `matching_*`,
  `drivers_online`, `auth_logins_total`, `ride_time_to_match_seconds`) and `@WithSpan` spans; the agent provides the SDK.
* **Logs ↔ traces ↔ spans** - log lines carry `trace_id=… span_id=…`. In Grafana open *RideShare - Logs & Traces*, expand a log
  line and press **View trace**; from a span use *Logs for this span*. Histogram exemplars link latency graphs to traces.
* **Dashboards** (folder *RideShare*): *Services Overview* (uptime, availability SLI/SLO 99.5 %, latency SLO < 500 ms,
  error budget + burn rate, p50/p95/p99, successful vs failed requests, error rates, container and node CPU/memory,
  business KPIs, logs, error traces), *Logs & Traces*, *MySQL & ProxySQL*, *Kafka*, *Redis*.
* **Alerts** (Grafana-managed, `provisioning/alerting`): container CPU > 50 %, container memory > 50 % (of the container
  limit; the app containers have 1 CPU / 1 GB limits), node CPU > 50 %, node memory > 50 %, plus service down, 5xx > 5 %
  and p95 > 1 s. E-mails go through `observability/grafana/grafana.ini` `[smtp]`, which defaults to the bundled Mailpit
  - open http://localhost:8025. For a real provider set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`,
  `SMTP_FROM`, `SMTP_STARTTLS`, `ALERT_EMAIL_TO` in `.env`.
* A JVM idling at 50-60 % of a 1 GB limit will legitimately trigger the memory alert under load - raise the limits in
  `docker-compose.yml` or the threshold in `alert-rules.yaml` if that is too chatty.

## Performance tests (`tests/`)
k6 scripts: smoke, load, stress, spike, soak, breakpoint and an end-to-end ride-flow test. See [`tests/README.md`](tests/README.md).

```bash
docker compose --profile tests run --rm k6 run /scripts/smoke.js
./tests/run.sh load
```

## Changes made to the original code
* `pom.xml` (ride, matching): `<n>` → `<name>` (invalid element, Maven refused to build).
* All services read their infrastructure addresses from environment variables; Hibernate no longer mutates the schema.
* **ride-service**: removed a race where a late `save` could overwrite a driver assignment; invalid transitions return 409,
  unknown rides 404 (was 400 for everything); added `GET /rides`, `/rides/stats`, `/rides/driver/{id}`, status `NO_DRIVERS_AVAILABLE`,
  `updatedAt` in responses.
* **matching-service**: when no driver is found (or matching fails) it now publishes an empty match so the rider isn't left in
  `MATCHING` forever.
* **location-service**: `limit` query parameter on `/drivers/nearby`.
* New `auth-service`, `api-gateway`, `frontend`; MySQL credentials are no longer hard-coded in `application.yaml`.

## Known limitations
* Dev-only credentials and secrets (`.env`, SQL, `proxysql.cnf`). Change them before exposing anything.
* A matched driver stays in the Redis geo set (no busy/free state), so several rides can pick the same driver.
* The gateway authenticates users but ride endpoints trust the `riderId` in the request body.
* Public OSM tile/Nominatim/OSRM servers are for light development use only (see their usage policies).
* Infrastructure containers (MySQL, Kafka, Redis) don't ship logs to Loki - only the Java services do.
