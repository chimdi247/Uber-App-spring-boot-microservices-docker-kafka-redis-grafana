#!/bin/sh
# Runs from /docker-entrypoint.d before nginx starts: renders /config.js from the container environment.
set -eu
: "${MAP_CENTER_LAT:=12.9716}" "${MAP_CENTER_LNG:=77.5946}" "${MAP_ZOOM:=13}"
: "${MAP_TILE_URL:=https://tile.openstreetmap.org/{z}/{x}/{y}.png}"
: "${MAP_TILE_ATTRIBUTION:=&copy; OpenStreetMap contributors}"
: "${GEOCODER_URL:=https://nominatim.openstreetmap.org}"
: "${GRAFANA_URL:=http://34.171.152.81:3000}" "${KAFKA_UI_URL:=34.171.152.81:8085}" "${REDIS_UI_URL:=http://34.171.152.81:8087}"
: "${MAILPIT_URL:=http://34.171.152.81:8025}" "${PROMETHEUS_URL:=http://34.171.152.81:9090}"
export MAP_CENTER_LAT MAP_CENTER_LNG MAP_ZOOM MAP_TILE_URL MAP_TILE_ATTRIBUTION GEOCODER_URL \
       GRAFANA_URL KAFKA_UI_URL REDIS_UI_URL MAILPIT_URL PROMETHEUS_URL
envsubst < /etc/rideshare/config.js.template > /usr/share/nginx/html/config.js
echo "rendered /config.js"
