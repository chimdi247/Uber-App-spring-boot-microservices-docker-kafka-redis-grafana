package com.rideshare.locationservice.service;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Prometheus names: driver_location_updates_total, driver_nearby_searches_total,
 * driver_nearby_search_empty_total, drivers_online
 */
@Component
public class LocationMetrics {

    private final LongCounter updates;
    private final LongCounter searches;
    private final LongCounter emptySearches;

    public LocationMetrics(RedisTemplate<String, String> redisTemplate) {
        Meter meter = GlobalOpenTelemetry.getMeter("com.rideshare.locationservice");
        updates = meter.counterBuilder("driver.location.updates").setDescription("Driver GPS updates received").build();
        searches = meter.counterBuilder("driver.nearby.searches").setDescription("Nearby driver searches").build();
        emptySearches = meter.counterBuilder("driver.nearby.search.empty").setDescription("Nearby searches with no driver found").build();

        meter.gaugeBuilder("drivers.online")
                .ofLongs()
                .setDescription("Drivers currently present in the Redis geo set")
                .buildWithCallback(m -> {
                    try {
                        Long size = redisTemplate.opsForZSet().zCard(LocationService.DRIVERS_GEO_KEY);
                        m.record(size == null ? 0 : size);
                    } catch (Exception ignored) {
                        // Redis temporarily unavailable - skip this observation
                    }
                });
    }

    public void locationUpdated() { updates.add(1); }

    public void nearbySearched(int found) {
        searches.add(1);
        if (found == 0) {
            emptySearches.add(1);
        }
    }
}
