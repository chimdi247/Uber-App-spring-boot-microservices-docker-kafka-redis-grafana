#!/bin/sh
# One-shot job for the optional "osrm" compose profile.
# Downloads an OpenStreetMap extract and builds the OSRM (MLD) routing graph into /data.
set -eu
cd /data
if [ -f region.osrm.mldgr ]; then
  echo "OSRM data already prepared - skipping"; exit 0
fi
URL="${OSRM_PBF_URL:?set OSRM_PBF_URL in .env}"
if [ ! -f region.osm.pbf ]; then
  if ! command -v curl >/dev/null 2>&1; then
    apt-get update && apt-get install -y --no-install-recommends curl ca-certificates
  fi
  echo "Downloading $URL"
  curl -fL --retry 3 -o region.osm.pbf.tmp "$URL"
  mv region.osm.pbf.tmp region.osm.pbf
fi
osrm-extract -p /opt/car.lua /data/region.osm.pbf
osrm-partition /data/region.osrm
osrm-customize /data/region.osrm
echo "OSRM data ready"
