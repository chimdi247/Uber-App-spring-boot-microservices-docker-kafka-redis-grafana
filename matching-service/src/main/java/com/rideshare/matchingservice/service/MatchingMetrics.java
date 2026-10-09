package com.rideshare.matchingservice.service;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.metrics.DoubleHistogram;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.Meter;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Prometheus names: matching_attempts_total, matching_success_total, matching_no_driver_total,
 * matching_errors_total, matching_duration_seconds_(bucket|sum|count)
 */
@Component
public class MatchingMetrics {

    private final LongCounter attempts;
    private final LongCounter success;
    private final LongCounter noDriver;
    private final LongCounter errors;
    private final DoubleHistogram duration;

    public MatchingMetrics() {
        Meter meter = GlobalOpenTelemetry.getMeter("com.rideshare.matchingservice");
        attempts = meter.counterBuilder("matching.attempts").setDescription("Ride requests consumed").build();
        success = meter.counterBuilder("matching.success").setDescription("Drivers assigned").build();
        noDriver = meter.counterBuilder("matching.no_driver").setDescription("Requests with no driver nearby").build();
        errors = meter.counterBuilder("matching.errors").setDescription("Matching failures").build();
        duration = meter.histogramBuilder("matching.duration").setUnit("s")
                .setDescription("Time spent matching a single ride")
                .setExplicitBucketBoundariesAdvice(List.of(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0))
                .build();
    }

    public void attempt() { attempts.add(1); }
    public void matched() { success.add(1); }
    public void noDriver() { noDriver.add(1); }
    public void error() { errors.add(1); }
    public void duration(double seconds) { duration.record(seconds); }
}
