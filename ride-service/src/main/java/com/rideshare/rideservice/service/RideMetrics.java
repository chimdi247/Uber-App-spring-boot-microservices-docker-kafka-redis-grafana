package com.rideshare.rideservice.service;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.metrics.DoubleCounter;
import io.opentelemetry.api.metrics.DoubleHistogram;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import org.springframework.stereotype.Component;

/**
 * Business KPIs exposed through the OpenTelemetry API.
 * The OpenTelemetry Java agent supplies the SDK, so these are exported over OTLP
 * (collector -> Prometheus -> Grafana) without any extra wiring.
 *
 * Prometheus names: rides_requested_total, rides_matched_total, rides_unmatched_total,
 * rides_started_total, rides_completed_total, rides_cancelled_total, rides_revenue_total,
 * ride_time_to_match_seconds_(bucket|sum|count)
 */
@Component
public class RideMetrics {

    private final LongCounter requested;
    private final LongCounter matched;
    private final LongCounter unmatched;
    private final LongCounter started;
    private final LongCounter completed;
    private final LongCounter cancelled;
    private final DoubleCounter revenue;
    private final DoubleHistogram timeToMatch;

    public RideMetrics() {
        Meter meter = GlobalOpenTelemetry.getMeter("com.rideshare.rideservice");
        requested = meter.counterBuilder("rides.requested").setDescription("Rides requested by riders").build();
        matched = meter.counterBuilder("rides.matched").setDescription("Rides assigned to a driver").build();
        unmatched = meter.counterBuilder("rides.unmatched").setDescription("Rides for which no driver was found").build();
        started = meter.counterBuilder("rides.started").setDescription("Rides started").build();
        completed = meter.counterBuilder("rides.completed").setDescription("Rides completed").build();
        cancelled = meter.counterBuilder("rides.cancelled").setDescription("Rides cancelled").build();
        revenue = meter.counterBuilder("rides.revenue").ofDoubles().setDescription("Fare revenue of completed rides").build();
        timeToMatch = meter.histogramBuilder("ride.time_to_match")
                .setUnit("s")
                .setDescription("Seconds between ride request and driver assignment")
                .setExplicitBucketBoundariesAdvice(java.util.List.of(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0))
                .build();
    }

    public void rideRequested() { requested.add(1); }
    public void rideMatched(double seconds) { matched.add(1); timeToMatch.record(seconds); }
    public void rideUnmatched() { unmatched.add(1); }
    public void rideStarted() { started.add(1); }
    public void rideCompleted(double fare) { completed.add(1); revenue.add(fare); }
    public void rideCancelled() { cancelled.add(1); }
}
