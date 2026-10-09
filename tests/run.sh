#!/usr/bin/env bash
# Convenience wrapper:  ./tests/run.sh smoke|load|stress|spike|soak|breakpoint|ride-flow
# Results are streamed to Prometheus (visible in Grafana) in addition to the console summary.
set -euo pipefail
cd "$(dirname "$0")/.."
T="${1:-smoke}"
shift || true
docker compose --profile tests run --rm k6 run -o experimental-prometheus-rw --tag testid="$T-$(date +%s)" "$@" "/scripts/${T}.js"
